'use client';

import { useRef, useState } from 'react';
import { colorHex } from '@ctb/shared';
import { useSessionStore } from '@/store/sessionStore';
import { useMyTileCount } from '@/hooks/useMyTileCount';
import { resetGame } from '@/lib/actions';
import { RoundTimer } from './RoundTimer';

export function TopBar() {
  const me = useSessionStore((s) => s.me);
  const online = useSessionStore((s) => s.online);
  const connection = useSessionStore((s) => s.connection);
  const myTiles = useMyTileCount();
  const connected = connection === 'connected';

  // Inline two-tap confirm (no modal): first tap arms, second tap within 3s resets.
  const [confirming, setConfirming] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onNewGame = () => {
    if (confirming) {
      if (timer.current) clearTimeout(timer.current);
      setConfirming(false);
      resetGame();
    } else {
      setConfirming(true);
      timer.current = setTimeout(() => setConfirming(false), 3000);
    }
  };

  return (
    <header className="fixed inset-x-0 top-0 z-30 flex items-center justify-between gap-2 p-3 sm:gap-3 sm:p-4">
      <div className="glass flex items-center gap-2.5 rounded-full px-3 py-1.5 sm:px-4 sm:py-2">
        <span
          className="h-2.5 w-2.5 rotate-45 rounded-[2px]"
          style={{ background: 'var(--accent)', boxShadow: '0 0 12px var(--accent)' }}
        />
        <span className="hidden text-sm font-semibold tracking-tight sm:inline">
          Capture<span className="text-[var(--text-faint)]">/Board</span>
        </span>
      </div>

      <div className="flex items-center gap-2">
        <div className="glass flex items-center gap-2 rounded-full px-3 py-1.5 sm:px-4 sm:py-2">
          <span
            className="dot-pulse h-2 w-2 rounded-full"
            style={{ color: connected ? '#8fe3c4' : '#ff9a9a', background: connected ? '#8fe3c4' : '#ff9a9a' }}
          />
          <span className="mono text-xs text-[var(--text-dim)]">
            {connected ? (
              <>
                {online}
                <span className="hidden sm:inline"> online</span>
              </>
            ) : (
              'offline'
            )}
          </span>
        </div>
        <RoundTimer />
      </div>

      <div className="flex min-w-0 items-center gap-2">
        <button
          onClick={onNewGame}
          title="Clear the board and start fresh (affects everyone)"
          className={`glass flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition sm:px-3.5 sm:py-2 ${
            confirming
              ? 'text-white shadow-[0_0_18px_-4px_#ff9a9a] ring-1 ring-[#ff9a9a]/50'
              : 'text-[var(--text-dim)] hover:text-white hover:shadow-[0_0_18px_-4px_var(--accent)]'
          }`}
        >
          <span className="text-sm leading-none">↻</span>
          {/* label hidden on mobile unless confirming (keeps the destructive action clear) */}
          <span className={confirming ? 'inline' : 'hidden sm:inline'}>
            {confirming ? 'Confirm?' : 'New game'}
          </span>
        </button>

        <div className="glass flex min-w-0 items-center gap-2 rounded-full px-3 py-1.5 sm:gap-3 sm:px-4 sm:py-2">
          {me && (
            <>
              <span
                className="h-3 w-3 shrink-0 rounded-[3px]"
                style={{ background: colorHex(me.color), boxShadow: `0 0 8px ${colorHex(me.color)}` }}
              />
              <span className="max-w-[5rem] truncate text-sm font-medium sm:max-w-[8rem]">{me.name}</span>
              <span className="hidden h-3 w-px bg-[var(--hairline)] sm:block" />
              <span className="mono hidden text-xs text-[var(--text-dim)] sm:inline">
                <span className="text-[var(--text)]">{myTiles}</span> tiles
              </span>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
