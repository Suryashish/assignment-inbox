import { EVENTS, TICK_MS, type ClaimedTile } from '@ctb/shared';
import { KEYS, subscriber } from './redis';
import { computeLeaderboard } from './gameService';
import type { IO } from './ioTypes';

/** Leaderboard is expensive-ish (HGETALL + flood-fill); recompute at most this often. */
const LEADERBOARD_INTERVAL_MS = 700;

/**
 * Turns the claim firehose into a steady, bounded stream of updates.
 *
 * Every claim publishes a delta to a Redis channel; we coalesce all deltas that
 * arrive within a TICK and emit ONE `tiles:update` batch per tick. So each
 * client receives ~`1000/TICK_MS` messages/sec no matter how many users are
 * active — fan-out is O(users), not O(users²). Routing deltas through Redis
 * pub/sub (rather than emitting inline) is also what lets this scale to N
 * instances unchanged: each instance batches for its own sockets.
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

  const tick = setInterval(() => {
    if (buffer.size === 0) return;
    const batch = Array.from(buffer.values());
    buffer.clear();
    io.emit(EVENTS.tilesUpdate, batch);
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
