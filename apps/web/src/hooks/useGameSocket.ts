'use client';

import { useEffect } from 'react';
import type { ClaimedTile } from '@ctb/shared';
import { getSocket } from '@/lib/socket';
import { rejoin } from '@/lib/actions';
import { sfx, setMuted } from '@/lib/sfx';
import { useGridStore } from '@/store/gridStore';
import { useSessionStore, type Capture } from '@/store/sessionStore';

/**
 * Wires the shared socket to the stores. Mounted once near the app root.
 * Incoming tile batches are buffered and flushed inside a single rAF, so a
 * burst of updates becomes one React render instead of many.
 */
export function useGameSocket(): void {
  useEffect(() => {
    const socket = getSocket();
    const session = useSessionStore.getState;
    const grid = useGridStore.getState;

    const onConnect = () => {
      session().setConnection('connected');
      // If we were already in-game, re-sync on (re)connect.
      if (session().joined) rejoin();
    };
    const onDisconnect = () => session().setConnection('disconnected');

    // Batched, rAF-aligned application of tile updates.
    let raf = 0;
    const queue: ClaimedTile[] = [];
    const flush = () => {
      raf = 0;
      if (queue.length === 0) return;
      const batch = queue.splice(0, queue.length);

      // Only count a capture when a tile's OWNER actually changes (a real gain) —
      // not self-overwrites / power-up re-claims of tiles already owned. Read the
      // pre-batch state before applying.
      const before = grid().tiles;
      const captures: Capture[] = [];
      for (const t of batch) {
        const cur = before.get(t.id);
        if (t.seq > (cur?.seq ?? 0) && cur?.owner !== t.owner) {
          captures.push({ ownerId: t.owner, name: session().resolveUser(t.owner).name, color: t.color });
        }
      }

      grid().applyBatch(batch);
      if (captures.length) session().recordCaptures(captures);
    };
    const onTiles = (batch: ClaimedTile[]) => {
      for (const t of batch) queue.push(t);
      if (!raf) raf = requestAnimationFrame(flush);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('tiles:update', onTiles);
    socket.on('leaderboard:update', (lb) => session().setLeaderboard(lb));
    socket.on('presence:update', ({ online }) => session().setOnline(online));
    const onReset = () => {
      grid().applySnapshot([]);
      session().setLeaderboard([]);
      session().clearActivity();
      session().setCursors([]);
    };
    socket.on('board:reset', onReset);

    socket.on('round:state', (round) => session().setRound(round));
    socket.on('round:end', (result) => {
      session().setRoundResult(result);
      sfx.win();
      // Auto-clear the celebration shortly before the next round begins.
      setTimeout(() => session().setRoundResult(null), 3800);
    });
    socket.on('cursors:update', (cursors) => session().setCursors(cursors));
    socket.on('power:spawn', (p) => grid().addPowerup(p));
    socket.on('power:despawn', ({ tileId }) => grid().removePowerup(tileId));

    setMuted(session().muted);
    if (socket.connected) onConnect();

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('tiles:update', onTiles);
      socket.off('leaderboard:update');
      socket.off('presence:update');
      socket.off('board:reset', onReset);
      socket.off('round:state');
      socket.off('round:end');
      socket.off('cursors:update');
      socket.off('power:spawn');
      socket.off('power:despawn');
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
}
