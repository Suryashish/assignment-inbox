'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { colorHex, TILE_COUNT } from '@ctb/shared';
import { useSessionStore } from '@/store/sessionStore';
import { useBoardStats } from '@/hooks/useBoardStats';

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center rounded-lg bg-white/[0.03] px-2 py-1.5">
      <span className="mono text-sm font-semibold tabular-nums">{value}</span>
      <span className="micro-label mt-0.5">{label}</span>
    </div>
  );
}

export function Leaderboard() {
  const leaderboard = useSessionStore((s) => s.leaderboard);
  const online = useSessionStore((s) => s.online);
  const myId = useSessionStore((s) => s.me?.id);
  const stats = useBoardStats();

  const meInList = leaderboard.some((e) => e.userId === myId);

  return (
    <div className="glass flex flex-col gap-3 rounded-2xl p-4">
      <div className="flex items-baseline justify-between">
        <span className="micro-label">Standings</span>
        <span className="mono text-xs text-[var(--text-dim)]">
          <span className="text-[var(--text)]">{Math.round(stats.coverage * 100)}%</span> claimed
        </span>
      </div>

      {/* Board-control bar — each color's share of the whole board */}
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-white/[0.05]">
        {stats.composition.map((seg) => {
          const hex = colorHex(seg.color);
          return (
            <div
              key={seg.color}
              style={{ width: `${(seg.count / TILE_COUNT) * 100}%`, background: hex, boxShadow: `0 0 8px -2px ${hex}` }}
            />
          );
        })}
      </div>

      {/* Global stats */}
      <div className="grid grid-cols-3 gap-1.5">
        <Stat label="Players" value={String(stats.players)} />
        <Stat label="Online" value={String(online)} />
        <Stat label="Your rank" value={stats.myRank ? `#${stats.myRank}` : '—'} />
      </div>

      {/* Ranked list */}
      {leaderboard.length === 0 ? (
        <p className="py-3 text-center text-xs text-[var(--text-faint)]">No captures yet — be the first.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          <AnimatePresence initial={false}>
            {leaderboard.map((e, i) => {
              const hex = colorHex(e.color);
              const isMe = e.userId === myId;
              const share = stats.claimed > 0 ? e.tiles / stats.claimed : 0;
              return (
                <motion.li
                  key={e.userId}
                  layout
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  className={`relative overflow-hidden rounded-lg px-2.5 py-1.5 ${
                    isMe ? 'bg-white/[0.06] ring-1 ring-[var(--hairline-strong)]' : ''
                  }`}
                >
                  {/* subtle share bar behind the row */}
                  <div
                    className="absolute inset-y-0 left-0 -z-0 opacity-[0.10]"
                    style={{ width: `${share * 100}%`, background: hex }}
                  />
                  <div className="relative z-10 flex items-center gap-2.5">
                    <span className="w-4 text-center text-xs">
                      {i === 0 ? '👑' : <span className="mono text-[var(--text-faint)]">{i + 1}</span>}
                    </span>
                    <span className="h-3 w-3 shrink-0 rounded-[3px]" style={{ background: hex, boxShadow: `0 0 8px -1px ${hex}` }} />
                    <span className="flex-1 truncate text-sm">
                      {e.name}
                      {isMe && <span className="ml-1 text-[var(--text-faint)]">you</span>}
                    </span>
                    <span className="mono text-sm tabular-nums">{e.tiles}</span>
                    <span className="mono w-7 text-right text-xs text-[var(--text-faint)] tabular-nums" title="largest contiguous block">
                      ◧{e.largestCluster}
                    </span>
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}

      {/* Your standing, when you're outside the visible top list */}
      {!meInList && stats.myTiles > 0 && (
        <div className="flex items-center gap-2.5 rounded-lg bg-white/[0.06] px-2.5 py-1.5 ring-1 ring-[var(--hairline-strong)]">
          <span className="mono w-4 text-center text-xs text-[var(--text-faint)]">#{stats.myRank}</span>
          <span className="flex-1 truncate text-sm">
            You <span className="text-[var(--text-faint)]">· outside top {leaderboard.length}</span>
          </span>
          <span className="mono text-sm tabular-nums">{stats.myTiles}</span>
        </div>
      )}
    </div>
  );
}
