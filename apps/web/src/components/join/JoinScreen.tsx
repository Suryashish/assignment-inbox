'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { PALETTE, sanitizeName, isValidName } from '@ctb/shared';
import { GlowButton } from '@/components/ui/GlowButton';
import { ColorSwatch } from '@/components/ui/ColorSwatch';
import { joinGame } from '@/lib/actions';
import { useSessionStore } from '@/store/sessionStore';

export function JoinScreen() {
  const me = useSessionStore((s) => s.me);
  const connection = useSessionStore((s) => s.connection);
  const [name, setName] = useState(me?.name ?? '');
  const [color, setColor] = useState(me?.color ?? PALETTE[0]!.id);

  const ready = isValidName(name);
  const submit = () => {
    if (!ready) return;
    joinGame(sanitizeName(name), color);
  };

  return (
    <div className="relative z-10 flex h-dvh w-screen items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 26 }}
        className="glass w-full max-w-md rounded-3xl p-8"
      >
        <div className="mb-1 flex items-center gap-2">
          <span className="h-2.5 w-2.5 rotate-45 rounded-[2px]" style={{ background: 'var(--accent)', boxShadow: '0 0 12px var(--accent)' }} />
          <span className="micro-label">Capture the Board</span>
        </div>
        <h1 className="mb-1.5 text-2xl font-semibold tracking-tight">Claim your squares.</h1>
        <p className="mb-7 text-sm leading-relaxed text-[var(--text-dim)]">
          A live, shared grid. Pick a name and a color, then start capturing tiles — everyone sees
          every move the instant it happens.
        </p>

        <label className="micro-label mb-2 block">Display name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          maxLength={18}
          placeholder="e.g. nova"
          className="mb-6 w-full rounded-xl border border-[var(--hairline)] bg-black/30 px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--accent-soft)]"
          autoFocus
        />

        <label className="micro-label mb-2.5 block">Your color</label>
        <div className="mb-8 grid grid-cols-6 gap-2.5">
          {PALETTE.map((c) => (
            <ColorSwatch key={c.id} color={c} selected={c.id === color} onSelect={setColor} />
          ))}
        </div>

        <GlowButton onClick={submit} disabled={!ready} className="w-full">
          Enter the board
        </GlowButton>

        <p className="mt-4 text-center text-xs text-[var(--text-faint)]">
          {connection === 'connected'
            ? 'Connected — live and ready.'
            : connection === 'disconnected'
              ? 'Reconnecting to the server…'
              : 'Connecting…'}
        </p>
      </motion.div>
    </div>
  );
}
