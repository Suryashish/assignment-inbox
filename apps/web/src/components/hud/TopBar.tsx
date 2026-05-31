'use client';

import { colorHex } from '@ctb/shared';
import { useSessionStore } from '@/store/sessionStore';
import { useMyTileCount } from '@/hooks/useMyTileCount';

export function TopBar() {
  const me = useSessionStore((s) => s.me);
  const online = useSessionStore((s) => s.online);
  const connection = useSessionStore((s) => s.connection);
  const myTiles = useMyTileCount();
  const connected = connection === 'connected';

  return (
    <header className="fixed inset-x-0 top-0 z-30 flex items-center justify-between gap-3 p-4">
      <div className="glass flex items-center gap-2.5 rounded-full px-4 py-2">
        <span
          className="h-2.5 w-2.5 rotate-45 rounded-[2px]"
          style={{ background: 'var(--accent)', boxShadow: '0 0 12px var(--accent)' }}
        />
        <span className="text-sm font-semibold tracking-tight">
          Capture<span className="text-[var(--text-faint)]">/Board</span>
        </span>
      </div>

      <div className="glass flex items-center gap-2 rounded-full px-4 py-2">
        <span
          className="dot-pulse h-2 w-2 rounded-full"
          style={{ color: connected ? '#8fe3c4' : '#ff9a9a', background: connected ? '#8fe3c4' : '#ff9a9a' }}
        />
        <span className="mono text-xs text-[var(--text-dim)]">
          {connected ? `${online} online` : 'offline'}
        </span>
      </div>

      <div className="glass flex items-center gap-3 rounded-full px-4 py-2">
        {me && (
          <>
            <span
              className="h-3 w-3 rounded-[3px]"
              style={{ background: colorHex(me.color), boxShadow: `0 0 8px ${colorHex(me.color)}` }}
            />
            <span className="max-w-[8rem] truncate text-sm font-medium">{me.name}</span>
            <span className="h-3 w-px bg-[var(--hairline)]" />
            <span className="mono text-xs text-[var(--text-dim)]">
              <span className="text-[var(--text)]">{myTiles}</span> tiles
            </span>
          </>
        )}
      </div>
    </header>
  );
}
