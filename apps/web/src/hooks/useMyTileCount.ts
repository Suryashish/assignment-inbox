'use client';

import { useGridStore } from '@/store/gridStore';
import { useSessionStore } from '@/store/sessionStore';

/** How many tiles I currently own — derived live from the grid store. */
export function useMyTileCount(): number {
  const myId = useSessionStore((s) => s.me?.id);
  return useGridStore((s) => {
    if (!myId) return 0;
    let count = 0;
    for (const t of s.tiles.values()) if (t.owner === myId) count++;
    return count;
  });
}
