'use client';

import { colorHex } from '@ctb/shared';
import { useSessionStore } from '@/store/sessionStore';

/** Other players' live cursors, positioned in board space (moves with zoom/pan). */
export function CursorLayer() {
  const cursors = useSessionStore((s) => s.cursors);
  const myId = useSessionStore((s) => s.me?.id);

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      {cursors
        .filter((c) => c.id !== myId)
        .map((c) => {
          const hex = colorHex(c.color);
          return (
            <div
              key={c.id}
              className="absolute transition-all duration-75 ease-linear"
              style={{ left: `${c.x * 100}%`, top: `${c.y * 100}%` }}
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
                {c.name}
              </span>
            </div>
          );
        })}
    </div>
  );
}
