'use client';

import { motion, useReducedMotion } from 'framer-motion';

/** Soft aurora orbs for atmospheric depth. */
const ORBS = [
  { top: '-12%', left: '8%', size: 520, color: 'rgba(154,166,255,0.20)', dur: 19 },
  { top: '55%', left: '68%', size: 560, color: 'rgba(143,227,196,0.16)', dur: 23 },
  { top: '20%', left: '82%', size: 380, color: 'rgba(255,158,196,0.14)', dur: 21 },
  { top: '70%', left: '12%', size: 420, color: 'rgba(201,166,255,0.12)', dur: 25 },
];

/** Floating "tiles" — on-theme confetti with depth (varied size / blur / opacity). */
const TILES = [
  { top: '14%', left: '10%', size: 56, rot: -10, blur: 0, op: 0.5, c: '#9aa6ff', dur: 9, delay: 0, drift: 20 },
  { top: '22%', left: '78%', size: 40, rot: 12, blur: 1, op: 0.45, c: '#8fe3c4', dur: 11, delay: 1.2, drift: 16 },
  { top: '70%', left: '20%', size: 64, rot: 6, blur: 2, op: 0.35, c: '#ff9ec4', dur: 13, delay: 0.6, drift: 24 },
  { top: '78%', left: '72%', size: 48, rot: -6, blur: 1, op: 0.4, c: '#ffb38a', dur: 10, delay: 1.8, drift: 18 },
  { top: '40%', left: '6%', size: 30, rot: 14, blur: 0, op: 0.55, c: '#8fd2ff', dur: 8, delay: 0.3, drift: 14 },
  { top: '12%', left: '46%', size: 24, rot: -4, blur: 0, op: 0.5, c: '#f3d98b', dur: 7.5, delay: 2.1, drift: 12 },
  { top: '60%', left: '90%', size: 36, rot: 8, blur: 1, op: 0.4, c: '#c9a6ff', dur: 12, delay: 0.9, drift: 20 },
  { top: '86%', left: '44%', size: 44, rot: -12, blur: 2, op: 0.3, c: '#7fe6e0', dur: 14, delay: 1.5, drift: 22 },
  { top: '32%', left: '92%', size: 28, rot: 4, blur: 0, op: 0.5, c: '#bcd99a', dur: 9.5, delay: 0.4, drift: 16 },
  { top: '8%', left: '66%', size: 34, rot: -8, blur: 1, op: 0.42, c: '#e6a6c7', dur: 10.5, delay: 1.1, drift: 18 },
  { top: '50%', left: '84%', size: 22, rot: 10, blur: 0, op: 0.5, c: '#ff9a9a', dur: 8.5, delay: 1.7, drift: 13 },
  { top: '64%', left: '4%', size: 38, rot: -6, blur: 1, op: 0.4, c: '#d8c7a6', dur: 11.5, delay: 0.7, drift: 17 },
];

export function JoinBackdrop() {
  const reduce = useReducedMotion();

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {ORBS.map((o, i) => (
        <motion.div
          key={`orb-${i}`}
          className="absolute rounded-full"
          style={{
            top: o.top,
            left: o.left,
            width: o.size,
            height: o.size,
            background: `radial-gradient(circle, ${o.color}, transparent 70%)`,
            filter: 'blur(24px)',
          }}
          animate={reduce ? undefined : { x: [0, 30, 0], y: [0, -26, 0], scale: [1, 1.08, 1] }}
          transition={{ duration: o.dur, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}

      {TILES.map((t, i) => (
        <motion.div
          key={`tile-${i}`}
          className="absolute rounded-[7px]"
          style={{
            top: t.top,
            left: t.left,
            width: t.size,
            height: t.size,
            background: t.c,
            opacity: t.op,
            filter: t.blur ? `blur(${t.blur}px)` : undefined,
            boxShadow: `0 0 26px -6px ${t.c}`,
          }}
          animate={reduce ? undefined : { y: [0, -t.drift, 0], rotate: [t.rot, t.rot + 7, t.rot] }}
          transition={{ duration: t.dur, repeat: Infinity, ease: 'easeInOut', delay: t.delay }}
        />
      ))}

      {/* Darken the center a touch so the glass card stays crisp + readable. */}
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(46% 40% at 50% 50%, rgba(8,8,10,0.55), transparent 72%)' }}
      />
    </div>
  );
}
