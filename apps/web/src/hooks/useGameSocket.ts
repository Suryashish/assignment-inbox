'use client';

import { useEffect } from 'react';
import type { ClaimedTile } from '@ctb/shared';
import { getSocket } from '@/lib/socket';
import { rejoin } from '@/lib/actions';
import { useGridStore } from '@/store/gridStore';
import { useSessionStore, type ActivityItem } from '@/store/sessionStore';

let activityKey = 0;

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
      grid().applyBatch(batch);

      // Feed a lightweight activity stream (sampled so heavy bursts don't spam).
      const items: ActivityItem[] = [];
      for (const t of batch.slice(-6)) {
        const u = session().resolveUser(t.owner);
        items.push({ key: ++activityKey, name: u.name, color: t.color });
      }
      if (items.length) session().pushActivity(items);
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
      session().pushToast('info', 'A fresh game started — board cleared.');
    };
    socket.on('board:reset', onReset);

    if (socket.connected) onConnect();

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('tiles:update', onTiles);
      socket.off('leaderboard:update');
      socket.off('presence:update');
      socket.off('board:reset', onReset);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
}
