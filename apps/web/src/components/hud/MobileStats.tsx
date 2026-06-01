'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Leaderboard } from './Leaderboard';
import { ActivityFeed } from './ActivityFeed';

/**
 * Mobile-only access to Standings + Activity (the desktop side panel is hidden
 * below `lg`). A floating button opens a bottom sheet. Desktop is untouched.
 */
export function MobileStats() {
  const [open, setOpen] = useState(false);

  return (
    <div className="lg:hidden">
      <button
        onClick={() => setOpen(true)}
        aria-label="Open standings"
        className="glass fixed bottom-5 right-4 z-40 flex h-11 items-center gap-2 rounded-full px-4 text-sm font-medium text-[var(--text-dim)] transition hover:text-white"
      >
        <span className="text-base leading-none">📊</span> Stats
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-black/55"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />
            <motion.div
              className="fixed inset-x-0 bottom-0 z-50 flex max-h-[82vh] flex-col gap-3 overflow-y-auto rounded-t-3xl border-t border-[var(--hairline)] bg-[var(--bg)]/95 p-4 pb-7 backdrop-blur-xl"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 32, stiffness: 320 }}
            >
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="mx-auto mb-1 h-1.5 w-10 shrink-0 rounded-full bg-white/20"
              />
              <Leaderboard />
              <div className="max-h-56 overflow-hidden">
                <ActivityFeed />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
