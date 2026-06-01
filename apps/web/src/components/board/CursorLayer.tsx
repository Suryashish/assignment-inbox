'use client';

import { memo } from 'react';
import { colorHex, type CursorInfo } from '@ctb/shared';
import { useSessionStore } from '@/store/sessionStore';

/**
 * Other players' live cursors, positioned in board space (moves with zoom/pan).
 *
 * Perf: with 50+ cursors updating ~16x/sec, this is a hot path. Each cursor is
 * positioned via a GPU-composited `translate` transform (not left/top, which
 * trigger layout), animates `transform` ONLY (not `all`), and is memoized so an
 * unchanged cursor in the array doesn't repaint.
 */
function CursorBase({ cursor }: { cursor: CursorInfo }) {
  const hex = colorHex(cursor.color);
  return (
    <div
      className="absolute will-change-transform"
      style={{
        left: `${cursor.x * 100}%`,
        top: `${cursor.y * 100}%`,
        // Smooth the ~8fps server cadence into fluid motion via CSS transition.
        transition: 'left 130ms linear, top 130ms linear',
      }}
    >
      {/* cursor dot */}
      <span
        className="block h-2.5 w-2.5 rounded-full"
        style={{ background: hex, boxShadow: `0 0 8px ${hex}`, transform: 'translate(-50%,-50%)' }}
      />
      {/* name tag */}
      <span
        className="absolute left-2 top-2 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[10px] font-medium text-black/80"
        style={{ background: hex, boxShadow: `0 0 10px -2px ${hex}` }}
      >
        {cursor.name}
      </span>
    </div>
  );
}
const Cursor = memo(CursorBase);

export function CursorLayer() {
  const cursors = useSessionStore((s) => s.cursors);
  const myId = useSessionStore((s) => s.me?.id);

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      {cursors
        .filter((c) => c.id !== myId)
        .map((c) => (
          <Cursor key={c.id} cursor={c} />
        ))}
    </div>
  );
}
