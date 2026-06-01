'use client';

import { useEffect, useState } from 'react';
import type { ClaimedTile } from '@ctb/shared';
import { useGridStore } from '@/store/gridStore';

/**
 * A throttled view of the tiles map for EXPENSIVE derived aggregates
 * (tile counts, board composition, ranks). The raw store updates on every
 * server tick (~16/sec); recomputing an O(n) scan of ~1000 tiles that often is
 * the dominant frontend cost under load — and a "tiles owned" number or a
 * standings bar updating 3×/sec instead of 16×/sec is imperceptible.
 *
 * Per-tile rendering still subscribes to the live store directly, so individual
 * tiles flip color instantly; only the heavy whole-board math is throttled.
 */
export function useThrottledTiles(intervalMs = 350): Map<number, ClaimedTile> {
  const [snapshot, setSnapshot] = useState(() => useGridStore.getState().tiles);

  useEffect(() => {
    let latest = useGridStore.getState().tiles;
    let dirty = false;

    const unsub = useGridStore.subscribe((s) => {
      if (s.tiles !== latest) {
        latest = s.tiles;
        dirty = true;
      }
    });

    const id = setInterval(() => {
      if (!dirty) return;
      dirty = false;
      setSnapshot(latest);
    }, intervalMs);

    return () => {
      unsub();
      clearInterval(id);
    };
  }, [intervalMs]);

  return snapshot;
}
