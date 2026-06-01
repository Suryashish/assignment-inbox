'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useSessionStore } from '@/store/sessionStore';

export function ComboMeter() {
  const combo = useSessionStore((s) => s.combo);
  const expiresAt = useSessionStore((s) => s.comboExpiresAt);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (expiresAt <= Date.now()) return;
    const i = setInterval(() => setNow(Date.now()), 120);
    return () => clearInterval(i);
  }, [expiresAt]);

  const active = combo > 1 && now < expiresAt;

  return (
    // The popup positions itself (fixed, centered). Centering is baked into the
    // framer transform via x:'-50%' so it never fights the Tailwind transform, and
    // every copy is anchored at the same point so it can't drift between combos.
    <AnimatePresence>
      {active && (
        <motion.div
          key={combo}
          className="pointer-events-none fixed left-1/2 top-28 z-20 whitespace-nowrap text-center font-bold tracking-tight"
          initial={{ x: '-50%', scale: 0.6, opacity: 0, y: 8 }}
          animate={{ x: '-50%', scale: 1, opacity: 1, y: 0 }}
          exit={{ x: '-50%', scale: 0.8, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 480, damping: 18 }}
          style={{
            fontSize: `${Math.min(2.4, 1.1 + combo * 0.08)}rem`,
            color: 'var(--accent)',
            textShadow: '0 0 18px var(--accent)',
          }}
        >
          ×{combo} combo
        </motion.div>
      )}
    </AnimatePresence>
  );
}
