'use client';

import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useSessionStore, type ToastItem } from '@/store/sessionStore';

const TINT: Record<ToastItem['kind'], string> = {
  error: '#ff9a9a',
  warn: '#f3d98b',
  info: '#9aa6ff',
};

function Toast({ toast }: { toast: ToastItem }) {
  const remove = useSessionStore((s) => s.removeToast);
  useEffect(() => {
    const t = setTimeout(() => remove(toast.id), 2600);
    return () => clearTimeout(t);
  }, [toast.id, remove]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 14, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 420, damping: 30 }}
      className="glass flex items-center gap-2.5 rounded-xl px-4 py-2.5 text-sm"
    >
      <span className="h-2 w-2 rounded-full" style={{ background: TINT[toast.kind], boxShadow: `0 0 8px ${TINT[toast.kind]}` }} />
      <span className="text-[var(--text-dim)]">{toast.message}</span>
    </motion.div>
  );
}

export function Toaster() {
  const toasts = useSessionStore((s) => s.toasts);
  return (
    <div className="pointer-events-none fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-2">
      <AnimatePresence>
        {toasts.map((t) => (
          <Toast key={t.id} toast={t} />
        ))}
      </AnimatePresence>
    </div>
  );
}
