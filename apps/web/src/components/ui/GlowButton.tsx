'use client';

import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  disabled?: boolean;
  className?: string;
}

export function GlowButton({ children, onClick, type = 'button', disabled, className = '' }: Props) {
  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled}
      whileHover={disabled ? undefined : { scale: 1.025 }}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 400, damping: 24 }}
      className={`relative overflow-hidden rounded-xl px-5 py-3 text-sm font-semibold tracking-tight text-white transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
      style={{
        background: 'linear-gradient(180deg, rgba(154,166,255,0.28), rgba(154,166,255,0.12))',
        border: '1px solid rgba(154,166,255,0.45)',
        boxShadow: disabled ? 'none' : '0 0 28px -6px var(--accent), 0 1px 0 inset rgba(255,255,255,0.18)',
      }}
    >
      {children}
    </motion.button>
  );
}
