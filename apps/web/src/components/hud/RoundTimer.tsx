'use client';

import { useEffect, useState } from 'react';
import { useSessionStore } from '@/store/sessionStore';

function fmt(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function RoundTimer() {
  const durationMs = useSessionStore((s) => s.round.durationMs);
  const endsAt = useSessionStore((s) => s.roundEndsAt);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(i);
  }, []);

  const remaining = Math.max(0, endsAt - now);
  const pct = durationMs > 0 ? remaining / durationMs : 0;
  const low = remaining < 15_000;

  // Inline pill — rendered inside the top bar beside the online count.
  return (
    <div className="glass flex items-center gap-2 rounded-full px-3 py-1.5 sm:gap-2.5 sm:px-4 sm:py-2">
      <span className="text-sm leading-none">⏱</span>
      <span className={`mono text-xs font-semibold tabular-nums sm:text-sm ${low ? 'text-[#ff9a9a]' : ''}`}>
        {fmt(remaining)}
      </span>
      <div className="hidden h-1 w-14 overflow-hidden rounded-full bg-white/10 sm:block">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct * 100}%`, background: low ? '#ff9a9a' : 'var(--accent)', transition: 'width .25s linear' }}
        />
      </div>
    </div>
  );
}
