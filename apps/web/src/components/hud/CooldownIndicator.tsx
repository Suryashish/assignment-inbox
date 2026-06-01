'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useSessionStore } from '@/store/sessionStore';

export function CooldownIndicator() {
  const cooldownUntil = useSessionStore((s) => s.cooldownUntil);
  const cooldownMs = useSessionStore((s) => s.config.cooldownMs);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (cooldownUntil <= Date.now()) return;
    let raf = 0;
    const tick = () => {
      setNow(Date.now());
      if (Date.now() < cooldownUntil) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [cooldownUntil]);

  const remaining = Math.max(0, cooldownUntil - now);
  // Below ~200ms the cooldown is effectively instant — showing the pill is just noise.
  const active = remaining > 0 && cooldownMs >= 200;
  const pct = Math.min(1, remaining / cooldownMs);

  return (
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-40 -translate-x-1/2">
      <AnimatePresence>
        {active && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            className="glass flex items-center gap-3 rounded-full px-4 py-2"
          >
            <span className="micro-label">cooldown</span>
            <div className="relative h-1.5 w-32 overflow-hidden rounded-full bg-white/10">
              <div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{ width: `${pct * 100}%`, background: 'var(--accent)', boxShadow: '0 0 10px var(--accent)' }}
              />
            </div>
            <span className="mono w-9 text-right text-xs text-[var(--text-dim)]">{(remaining / 1000).toFixed(1)}s</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
