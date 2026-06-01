'use client';

import { motion } from 'framer-motion';
import { PALETTE } from '@ctb/shared';

const COUNT = 40;

/** A short celebratory confetti rain. Mounts only on round-end (client-only). */
export function Confetti() {
  const bits = Array.from({ length: COUNT }, (_, i) => ({
    left: Math.random() * 100,
    size: 6 + Math.random() * 9,
    delay: Math.random() * 0.35,
    dur: 1.8 + Math.random() * 1.3,
    rot: (Math.random() * 2 - 1) * 540,
    color: PALETTE[i % PALETTE.length]!.hex,
  }));

  return (
    <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
      {bits.map((b, i) => (
        <motion.span
          key={i}
          className="absolute rounded-[2px]"
          style={{ left: `${b.left}%`, top: '-6%', width: b.size, height: b.size, background: b.color, boxShadow: `0 0 8px -2px ${b.color}` }}
          initial={{ y: -20, opacity: 0, rotate: 0 }}
          animate={{ y: '112vh', opacity: [0, 1, 1, 0], rotate: b.rot }}
          transition={{ duration: b.dur, delay: b.delay, ease: 'easeIn' }}
        />
      ))}
    </div>
  );
}
