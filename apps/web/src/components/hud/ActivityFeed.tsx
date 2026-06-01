'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { colorHex } from '@ctb/shared';
import { useSessionStore } from '@/store/sessionStore';

export function ActivityFeed() {
  const activity = useSessionStore((s) => s.activity);

  return (
    <div className="glass flex min-h-0 flex-1 flex-col rounded-2xl p-4">
      <span className="micro-label mb-3 block">Live activity</span>
      {activity.length === 0 ? (
        <p className="text-xs text-[var(--text-faint)]">Captures will stream in here.</p>
      ) : (
        <ul className="scroll-soft flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pr-1">
          <AnimatePresence initial={false}>
            {activity.map((a) => {
              const hex = colorHex(a.color);
              return (
                <motion.li
                  key={a.key}
                  layout
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="flex items-center gap-2 text-xs text-[var(--text-dim)]"
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-[2px]"
                    style={{ background: hex, boxShadow: `0 0 6px ${hex}` }}
                  />
                  <span className="truncate">
                    <span className="text-[var(--text)]">{a.name}</span> captured{' '}
                    {a.count === 1 ? 'a tile' : `${a.count} tiles`}
                  </span>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}
