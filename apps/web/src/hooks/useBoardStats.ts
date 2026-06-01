'use client';

import { useMemo } from 'react';
import { TILE_COUNT } from '@ctb/shared';
import { useSessionStore } from '@/store/sessionStore';
import { useThrottledTiles } from './useThrottledTiles';

export interface BoardStats {
  claimed: number;
  coverage: number; // 0..1 of the board claimed
  players: number; // distinct owners with >= 1 tile
  myTiles: number;
  myRank: number; // 0 = unranked (no tiles)
  composition: { color: string; count: number }[]; // tiles per color, desc
}

/**
 * Rich, live stats derived from the full board the client already holds. Computed
 * from the grid store (not the server's top-N list), so coverage / player count /
 * your rank are always accurate and reset-safe. Recomputes only when tiles change.
 */
export function useBoardStats(): BoardStats {
  const myId = useSessionStore((s) => s.me?.id);
  // Throttled: the heavy whole-board scan runs a few times/sec, not 16×/sec.
  const tiles = useThrottledTiles();

  return useMemo(() => {
    const byOwner = new Map<string, number>();
    const byColor = new Map<string, number>();
    for (const t of tiles.values()) {
      byOwner.set(t.owner, (byOwner.get(t.owner) ?? 0) + 1);
      byColor.set(t.color, (byColor.get(t.color) ?? 0) + 1);
    }

    const claimed = tiles.size;
    const myTiles = myId ? (byOwner.get(myId) ?? 0) : 0;
    let myRank = 0;
    if (myTiles > 0) {
      myRank = 1;
      for (const c of byOwner.values()) if (c > myTiles) myRank++;
    }

    const composition = [...byColor.entries()]
      .map(([color, count]) => ({ color, count }))
      .sort((a, b) => b.count - a.count);

    return { claimed, coverage: claimed / TILE_COUNT, players: byOwner.size, myTiles, myRank, composition };
  }, [tiles, myId]);
}
