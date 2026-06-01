'use client';

import { useMemo } from 'react';
import { useSessionStore } from '@/store/sessionStore';
import { useThrottledTiles } from './useThrottledTiles';

/**
 * How many tiles I currently own — derived live from the grid store, but on a
 * throttled snapshot so the O(n) scan over ~1000 tiles runs a few times/sec
 * instead of on every server tick. (A header counter doesn't need 16fps.)
 */
export function useMyTileCount(): number {
  const myId = useSessionStore((s) => s.me?.id);
  const tiles = useThrottledTiles();

  return useMemo(() => {
    if (!myId) return 0;
    let count = 0;
    for (const t of tiles.values()) if (t.owner === myId) count++;
    return count;
  }, [tiles, myId]);
}
