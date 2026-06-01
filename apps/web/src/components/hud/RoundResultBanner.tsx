'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { colorHex } from '@ctb/shared';
import { useSessionStore } from '@/store/sessionStore';
import { Confetti } from './Confetti';

export function RoundResultBanner() {
  const result = useSessionStore((s) => s.roundResult);

  return (
    <AnimatePresence>
      {result && (
        <>
          <Confetti />
          <motion.div
            className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="glass-raised rounded-3xl px-8 py-7 text-center"
              initial={{ scale: 0.85, y: 16 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 240, damping: 22 }}
            >
              <div className="micro-label mb-2">Round over</div>
              {result.winner ? (
                <>
                  <div className="mb-1 text-4xl">🏆</div>
                  <div className="text-2xl font-semibold tracking-tight">
                    <span style={{ color: colorHex(result.winner.color) }}>{result.winner.name}</span> wins!
                  </div>
                  <div className="mt-2 text-sm text-[var(--text-dim)]">
                    {result.winner.tiles} tiles · {result.wins} {result.wins === 1 ? 'win' : 'wins'} total
                  </div>
                </>
              ) : (
                <div className="text-xl font-semibold">No captures — empty board!</div>
              )}
              <div className="mt-4 text-xs text-[var(--text-faint)]">Next round starting…</div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
