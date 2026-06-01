'use client';

import { useEffect } from 'react';

/**
 * Drives a tiny pointer-based parallax on the global `.backdrop` aurora by
 * setting --px/--py CSS vars. rAF-throttled and disabled for reduced-motion.
 * Renders nothing — it only nudges the existing backdrop so the board reads as
 * floating above a field that drifts opposite the cursor.
 */
export function ParallaxBackdrop() {
  useEffect(() => {
    const el = document.querySelector<HTMLElement>('.backdrop');
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let raf = 0;
    let tx = 0; // target
    let ty = 0;
    let cx = 0; // current (eased toward target)
    let cy = 0;
    const MAX = 14; // px of drift at the screen edge — deliberately small

    const onMove = (e: PointerEvent) => {
      // -1..1 from center, inverted so the field moves against the cursor.
      tx = -((e.clientX / window.innerWidth) * 2 - 1) * MAX;
      ty = -((e.clientY / window.innerHeight) * 2 - 1) * MAX;
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const tick = () => {
      // Exponential ease toward the target for a smooth glide.
      cx += (tx - cx) * 0.08;
      cy += (ty - cy) * 0.08;
      el.style.setProperty('--px', `${cx.toFixed(2)}px`);
      el.style.setProperty('--py', `${cy.toFixed(2)}px`);
      // Keep animating until we've essentially arrived.
      raf = Math.abs(tx - cx) > 0.1 || Math.abs(ty - cy) > 0.1 ? requestAnimationFrame(tick) : 0;
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      if (raf) cancelAnimationFrame(raf);
      el.style.removeProperty('--px');
      el.style.removeProperty('--py');
    };
  }, []);

  return null;
}
