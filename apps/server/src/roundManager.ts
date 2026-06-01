import { EVENTS, ROUND_INTERMISSION_MS, type RoundState } from '@ctb/shared';
import { config } from './config';
import { KEYS, redis } from './redis';
import { computeLeaderboard, resetBoard } from './gameService';
import { clearPowerups } from './powerups';
import type { IO } from './ioTypes';

let roundId = 0;
let endsAt = 0;
const durationMs = config.roundMs;

/** Current round, for snapshots. */
export function getRound(): RoundState {
  return { id: roundId, remainingMs: Math.max(0, endsAt - Date.now()), durationMs };
}

/**
 * Runs the match loop: each round lasts `durationMs`, then we crown the leader,
 * broadcast the result, wipe the board, pause for the celebration, and start over.
 */
export function startRounds(io: IO): () => void {
  let stopped = false;
  let roundTimer: ReturnType<typeof setTimeout> | null = null;

  const beginRound = () => {
    roundId++;
    endsAt = Date.now() + durationMs;
    io.emit(EVENTS.roundState, getRound());
  };

  const endRound = async () => {
    const leaderboard = await computeLeaderboard();
    const top = leaderboard[0] ?? null;
    let wins = 0;
    if (top) wins = Number(await redis.hincrby(KEYS.wins, top.userId, 1));
    io.emit(EVENTS.roundEnd, {
      winner: top ? { userId: top.userId, name: top.name, color: top.color, tiles: top.tiles } : null,
      leaderboard,
      wins,
    });
    await resetBoard();
    await clearPowerups(io);
    io.emit(EVENTS.boardReset);
    io.emit(EVENTS.leaderboardUpdate, []);
  };

  // 1s ticker keeps every client's countdown in sync (clock-skew safe).
  const ticker = setInterval(() => io.emit(EVENTS.roundState, getRound()), 1000);

  const loop = () => {
    if (stopped) return;
    beginRound();
    roundTimer = setTimeout(async () => {
      if (stopped) return;
      try {
        await endRound();
      } catch {
        /* ignore transient */
      }
      roundTimer = setTimeout(loop, ROUND_INTERMISSION_MS);
    }, durationMs);
  };
  loop();

  return () => {
    stopped = true;
    clearInterval(ticker);
    if (roundTimer) clearTimeout(roundTimer);
  };
}
