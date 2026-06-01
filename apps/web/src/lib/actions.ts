import { COOLDOWN_MS, type JoinResult } from '@ctb/shared';
import { getSocket } from './socket';
import { sfx } from './sfx';
import { useGridStore } from '@/store/gridStore';
import { useSessionStore } from '@/store/sessionStore';

/** Apply a join/reconnect snapshot to both stores. */
export function applyJoinResult(res: JoinResult, name?: string, color?: string): void {
  const session = useSessionStore.getState();
  const me = session.me;
  session.setMe({
    id: res.userId,
    name: name ?? me?.name ?? 'player',
    color: color ?? me?.color ?? 'periwinkle',
  });
  session.setConfig(res.snapshot.config);
  session.setOnline(res.snapshot.online);
  session.setLeaderboard(res.snapshot.leaderboard);
  session.setRound(res.snapshot.round);
  useGridStore.getState().applySnapshot(res.snapshot.tiles, res.snapshot.powerups);
  session.setJoined(true);
}

/** Throttled cursor broadcast (board-space 0..1 coords). */
let lastCursorAt = 0;
export function sendCursor(x: number, y: number): void {
  const now = Date.now();
  if (now - lastCursorAt < 70) return;
  lastCursorAt = now;
  getSocket().emit('cursor', { x, y });
}

/** Enter the board with a chosen name + color (reuses saved userId if present). */
export function joinGame(name: string, color: string): void {
  const me = useSessionStore.getState().me;
  getSocket().emit('join', { userId: me?.id, name, color }, (res) => applyJoinResult(res, name, color));
}

/** Re-join after a reconnect to fully resync (discards stale optimistic state). */
export function rejoin(): void {
  const me = useSessionStore.getState().me;
  if (!me) return;
  getSocket().emit('join', { userId: me.id, name: me.name, color: me.color }, (res) =>
    applyJoinResult(res),
  );
}

/** Start a fresh game — clears the shared board for everyone. */
export function resetGame(): void {
  getSocket().emit('reset');
}

/**
 * Optimistically paint a tile, then emit the claim and reconcile on the ack.
 * The server stays authoritative; this just makes the click feel instant.
 */
export function attemptClaim(tileId: number): void {
  const session = useSessionStore.getState();
  const grid = useGridStore.getState();
  const me = session.me;
  if (!me) return;
  if (Date.now() < session.cooldownUntil) return; // client-side guard; server re-checks

  // Already yours? Re-claiming is a no-op — don't spam the server, combo, or feed.
  if (grid.tiles.get(tileId)?.owner === me.id || grid.optimistic.get(tileId)?.owner === me.id) return;

  grid.setOptimistic(tileId, me.id, me.color);

  getSocket().emit('claim', { tileId }, (res) => {
    if (res.ok) {
      // Keep the optimistic paint until the authoritative broadcast applies the
      // tile and clears it. The broadcast is the single source that drives the
      // activity feed (owner-change diff), so our own captures show up there too.
      session.startCooldown(COOLDOWN_MS);
      const combo = session.bumpCombo();
      if (res.power) {
        sfx.power();
        navigator.vibrate?.([12, 30, 18]);
        session.pushToast('info', `${powerLabel(res.power)} grabbed!`);
      } else {
        sfx.capture(combo);
        navigator.vibrate?.(10);
      }
    } else {
      grid.clearOptimistic(tileId); // revert the optimistic paint
      if (res.reason === 'cooldown') session.startCooldown(res.remainingMs);
      else if (res.reason === 'locked')
        session.pushToast('warn', 'That tile is freshly shielded — try again in a moment.');
    }
  });
}

function powerLabel(p: 'bomb' | 'burst' | 'shield'): string {
  return p === 'bomb' ? '💣 Bomb' : p === 'burst' ? '🌟 Burst' : '🛡️ Shield';
}
