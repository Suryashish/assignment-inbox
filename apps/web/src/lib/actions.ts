import { COOLDOWN_MS, type JoinResult } from '@ctb/shared';
import { getSocket } from './socket';
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
  useGridStore.getState().applySnapshot(res.snapshot.tiles);
  session.setJoined(true);
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

  grid.setOptimistic(tileId, me.id, me.color);

  getSocket().emit('claim', { tileId }, (res) => {
    grid.clearOptimistic(tileId);
    if (res.ok) {
      grid.applyTile(res.tile);
      session.startCooldown(COOLDOWN_MS);
    } else if (res.reason === 'cooldown') {
      session.startCooldown(res.remainingMs);
    } else if (res.reason === 'locked') {
      session.pushToast('warn', 'That tile is freshly shielded — try again in a moment.');
    }
  });
}
