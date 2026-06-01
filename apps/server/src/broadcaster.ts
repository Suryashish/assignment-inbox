import { EVENTS, TICK_MS, type ClaimedTile, type CursorInfo } from '@ctb/shared';
import { KEYS, subscriber } from './redis';
import { computeLeaderboard } from './gameService';
import type { IO } from './ioTypes';

/** Leaderboard is expensive-ish (HGETALL + flood-fill); recompute at most this often. */
const LEADERBOARD_INTERVAL_MS = 700;
/** Drop a cursor if we haven't heard from it in this long. */
const CURSOR_STALE_MS = 1600;

// Live cursors, keyed by socket id. Updated by socket handlers, flushed per tick.
const cursors = new Map<string, CursorInfo & { ts: number }>();
export function recordCursor(socketId: string, info: CursorInfo): void {
  cursors.set(socketId, { ...info, ts: Date.now() });
}
export function removeCursor(socketId: string): void {
  cursors.delete(socketId);
}

/**
 * Turns the claim + cursor firehose into a steady, bounded stream of updates.
 * One coalesced `tiles:update` and one `cursors:update` per tick → fan-out is
 * O(users), not O(users²), no matter how fast people paint or move.
 */
export function startBroadcaster(io: IO): () => void {
  const buffer = new Map<number, ClaimedTile>();
  let leaderboardDirty = false;

  const onMessage = (channel: string, message: string) => {
    if (channel !== KEYS.channel) return;
    try {
      const tile = JSON.parse(message) as ClaimedTile;
      const existing = buffer.get(tile.id);
      if (!existing || tile.seq > existing.seq) buffer.set(tile.id, tile);
      leaderboardDirty = true;
    } catch {
      /* ignore malformed delta */
    }
  };
  subscriber.on('message', onMessage);
  void subscriber.subscribe(KEYS.channel);

  // Cursors are noisy: with many players, emitting the full list every tick
  // forces a client re-render 16x/sec even when nothing moved. We instead emit
  // at most every other tick (~8fps — plenty, the client interpolates), and skip
  // the emit entirely when the live set is byte-for-byte identical to last time.
  let cursorTickPhase = 0;
  let lastCursorJson = '';

  const tick = setInterval(() => {
    if (buffer.size > 0) {
      const batch = Array.from(buffer.values());
      buffer.clear();
      io.emit(EVENTS.tilesUpdate, batch);
    }

    // Cursors: prune the stale, then emit on a slower cadence + only on change.
    const now = Date.now();
    let pruned = false;
    for (const [id, c] of cursors) {
      if (now - c.ts > CURSOR_STALE_MS) {
        cursors.delete(id);
        pruned = true;
      }
    }
    cursorTickPhase = (cursorTickPhase + 1) % 2;
    if (cursorTickPhase === 0 || pruned) {
      const live: CursorInfo[] = [];
      for (const c of cursors.values()) {
        live.push({ id: c.id, name: c.name, color: c.color, x: c.x, y: c.y });
      }
      // Quantize coords into the key so sub-pixel jitter doesn't defeat the diff.
      const json = JSON.stringify(live.map((c) => [c.id, Math.round(c.x * 400), Math.round(c.y * 400)]));
      if (json !== lastCursorJson) {
        lastCursorJson = json;
        io.emit(EVENTS.cursorsUpdate, live);
      }
    }
  }, TICK_MS);

  const lbTimer = setInterval(() => {
    if (!leaderboardDirty) return;
    leaderboardDirty = false;
    computeLeaderboard()
      .then((lb) => io.emit(EVENTS.leaderboardUpdate, lb))
      .catch(() => {
        /* transient — next tick retries */
      });
  }, LEADERBOARD_INTERVAL_MS);

  return () => {
    clearInterval(tick);
    clearInterval(lbTimer);
    subscriber.off('message', onMessage);
  };
}
