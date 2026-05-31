'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { colorHex } from '@ctb/shared';
import { useSessionStore } from '@/store/sessionStore';

export function Leaderboard() {
  const leaderboard = useSessionStore((s) => s.leaderboard);
  const myId = useSessionStore((s) => s.me?.id);

  return (
    <div className="glass rounded-2xl p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <span className="micro-label">Leaderboard</span>
        <span className="micro-label">tiles · cluster</span>
      </div>

      {leaderboard.length === 0 ? (
        <p className="py-5 text-center text-xs text-[var(--text-faint)]">No captures yet — be the first.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          <AnimatePresence initial={false}>
            {leaderboard.map((e, i) => {
              const hex = colorHex(e.color);
              const isMe = e.userId === myId;
              return (
                <motion.li
                  key={e.userId}
                  layout
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 ${
                    isMe ? 'bg-white/[0.06] ring-1 ring-[var(--hairline-strong)]' : ''
                  }`}
                >
                  <span className="mono w-4 text-center text-xs text-[var(--text-faint)]">{i + 1}</span>
                  <span
                    className="h-3 w-3 shrink-0 rounded-[3px]"
                    style={{ background: hex, boxShadow: `0 0 8px -1px ${hex}` }}
                  />
                  <span className="flex-1 truncate text-sm">
                    {e.name}
                    {isMe && <span className="ml-1 text-[var(--text-faint)]">you</span>}
                  </span>
                  <span className="mono text-sm tabular-nums">{e.tiles}</span>
                  <span className="mono w-7 text-right text-xs text-[var(--text-faint)] tabular-nums">
                    {e.largestCluster}
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
