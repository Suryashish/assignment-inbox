'use client';

import { memo, useEffect, useRef, useState, type CSSProperties } from 'react';
import { colorHex } from '@ctb/shared';
import { useGridStore } from '@/store/gridStore';
import { useSessionStore } from '@/store/sessionStore';
import { attemptClaim } from '@/lib/actions';

/**
 * One board cell. Subscribes to ONLY its own tile + optimistic slice, so a
 * single tile update re-renders just this component, not the whole grid.
 */
function TileBase({ id }: { id: number }) {
  const tile = useGridStore((s) => s.tiles.get(id));
  const optimistic = useGridStore((s) => s.optimistic.get(id));
  const myId = useSessionStore((s) => s.me?.id);

  const view = optimistic ?? tile;
  const hex = view ? colorHex(view.color) : undefined;
  const mine = !!view && view.owner === myId;

  // Replay the capture ripple whenever the authoritative seq changes — but not
  // on first mount (otherwise the whole board ripples when a snapshot loads).
  const seq = tile?.seq ?? 0;
  const mounted = useRef(false);
  const [rippleKey, setRippleKey] = useState(0);
  useEffect(() => {
    if (mounted.current) setRippleKey((k) => k + 1);
    else mounted.current = true;
  }, [seq]);

  let className = 'tile';
  if (optimistic) className = 'tile tile--pending';
  else if (view) className = `tile tile--owned${mine ? ' tile--mine' : ''}`;

  const style = hex ? ({ '--c': hex } as CSSProperties) : undefined;

  return (
    <button className={className} style={style} onClick={() => attemptClaim(id)} aria-label={`tile ${id}`}>
      {rippleKey > 0 && tile && <span key={rippleKey} className="ripple" style={style} />}
    </button>
  );
}

export const Tile = memo(TileBase);
