/**
 * Interactive bot swarm — fills the board with lifelike players so you can join
 * as a human and play *against a crowd*. Unlike loadtest.ts (a throughput probe
 * that spams random tiles for a fixed window), this runs indefinitely and makes
 * the bots feel human:
 *
 *   • real-ish names + a spread of palette colors
 *   • live cursors that glide around (so you SEE them on the board)
 *   • territorial claiming — each bot favors tiles near its own cluster, so the
 *     board grows organic blobs of color instead of random static
 *   • varied pace + the occasional power-up grab
 *
 * Run it while the server + web app are up, then open the web app and join:
 *
 *   pnpm --filter @ctb/server botsim
 *   BOTS=50 pnpm --filter @ctb/server botsim
 *   BOTS=50 BOT_URL=http://localhost:4000 pnpm --filter @ctb/server botsim
 *
 * Ctrl-C to stop — bots disconnect cleanly and presence drops back to you.
 */
import { io as connect, type Socket } from 'socket.io-client';
import {
  GRID_COLS,
  GRID_ROWS,
  PALETTE,
  TILE_COUNT,
  toTileId,
  fromTileId,
  type ClaimResult,
  type ClientToServerEvents,
  type JoinResult,
  type ServerToClientEvents,
} from '@ctb/shared';

const URL = process.env.BOT_URL ?? 'http://localhost:4000';
const COUNT = Number(process.env.BOTS ?? 50);

type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const FIRST = [
  'nova', 'echo', 'pixel', 'comet', 'lynx', 'zephyr', 'orbit', 'mako', 'flux', 'wren',
  'juno', 'atlas', 'iris', 'kilo', 'vega', 'onyx', 'sable', 'ember', 'cleo', 'rook',
  'mira', 'dash', 'koda', 'pip', 'sol', 'nyx', 'arlo', 'wisp', 'bex', 'tau',
  'zola', 'fern', 'gus', 'lux', 'remy', 'ash', 'indi', 'cyan', 'odo', 'vale',
  'bolt', 'cove', 'drift', 'fox', 'haze', 'jinx', 'kit', 'lark', 'moss', 'reef',
];

const rand = (n: number) => Math.floor(Math.random() * n);
const pick = <T>(arr: readonly T[]): T => arr[rand(arr.length)]!;
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

const stats = { connected: 0, joined: 0, claimed: 0, rejected: 0, powers: 0 };

interface Bot {
  socket: ClientSocket;
  /** Home cell — the bot favors claims near here, growing an organic blob. */
  homeCol: number;
  homeRow: number;
  /** Current smoothed cursor position in board space (0..1). */
  cx: number;
  cy: number;
  /** Target cursor position the bot is gliding toward. */
  tx: number;
  ty: number;
  timers: ReturnType<typeof setInterval>[];
}

const bots: Bot[] = [];

/** Pick a tile near the bot's home with gaussian-ish spread (organic clusters). */
function targetTile(bot: Bot): number {
  // Box-Muller-lite: sum of uniforms ≈ normal. Spread widens over time so blobs grow.
  const spread = 3 + rand(5);
  const dc = Math.round((Math.random() + Math.random() + Math.random() - 1.5) * spread);
  const dr = Math.round((Math.random() + Math.random() + Math.random() - 1.5) * spread);
  const col = Math.min(GRID_COLS - 1, Math.max(0, bot.homeCol + dc));
  const row = Math.min(GRID_ROWS - 1, Math.max(0, bot.homeRow + dr));
  return toTileId(col, row);
}

function spawn(i: number) {
  const socket: ClientSocket = connect(URL, { transports: ['websocket'], forceNew: true });
  const homeCol = rand(GRID_COLS);
  const homeRow = rand(GRID_ROWS);
  const bot: Bot = {
    socket,
    homeCol,
    homeRow,
    cx: homeCol / GRID_COLS,
    cy: homeRow / GRID_ROWS,
    tx: homeCol / GRID_COLS,
    ty: homeRow / GRID_ROWS,
    timers: [],
  };
  bots.push(bot);

  socket.on('connect', () => {
    stats.connected++;
    const name = `${pick(FIRST)}${rand(100)}`;
    const color = PALETTE[i % PALETTE.length]!.id; // spread colors evenly across the swarm

    socket.emit('join', { name, color }, (_res: JoinResult) => {
      stats.joined++;

      // ── Claiming: a relaxed, human-ish pace (slower = calmer board + less load). ──
      const claimEvery = 1400 + rand(2600); // 1.4s–4.0s per bot
      const claimTimer = setInterval(() => {
        const tileId = targetTile(bot);
        socket.emit('claim', { tileId }, (res: ClaimResult) => {
          if (res.ok) {
            stats.claimed++;
            if (res.power) stats.powers++;
            // Drift the home toward freshly claimed ground so the blob migrates.
            const { col, row } = fromTileId(tileId);
            bot.homeCol = Math.round((bot.homeCol * 5 + col) / 6);
            bot.homeRow = Math.round((bot.homeRow * 5 + row) / 6);
          } else {
            stats.rejected++;
          }
        });
      }, claimEvery);
      bot.timers.push(claimTimer);

      // ── Wandering: pick a new cursor target occasionally. ──
      const wanderTimer = setInterval(() => {
        // Mostly hover near home; sometimes roam across the board.
        if (Math.random() < 0.8) {
          bot.tx = clamp01(bot.homeCol / GRID_COLS + (Math.random() - 0.5) * 0.18);
          bot.ty = clamp01(bot.homeRow / GRID_ROWS + (Math.random() - 0.5) * 0.18);
        } else {
          bot.tx = Math.random();
          bot.ty = Math.random();
        }
      }, 900 + rand(1600));
      bot.timers.push(wanderTimer);

      // ── Cursor broadcast: glide toward the target and emit (board-space 0..1).
      // ~7fps per bot is plenty — the server coalesces all cursors into one tick
      // anyway, and the client interpolates, so a higher rate just wastes work. ──
      const cursorTimer = setInterval(() => {
        bot.cx += (bot.tx - bot.cx) * 0.12;
        bot.cy += (bot.ty - bot.cy) * 0.12;
        socket.emit('cursor', { x: bot.cx, y: bot.cy });
      }, 140 + rand(60));
      bot.timers.push(cursorTimer);
    });
  });

  socket.on('disconnect', () => {
    for (const t of bot.timers) clearInterval(t);
    bot.timers = [];
  });
}

console.log(`[botsim] spawning ${COUNT} bots → ${URL}`);
console.log(`[botsim] board is ${GRID_COLS}×${GRID_ROWS} = ${TILE_COUNT} tiles. Ctrl-C to stop.\n`);

// Stagger connects a touch so we don't open 50 sockets in the same millisecond.
for (let i = 0; i < COUNT; i++) setTimeout(() => spawn(i), i * 40);

// Live status line so you can see the swarm is alive.
const statusTimer = setInterval(() => {
  process.stdout.write(
    `\r[botsim] online ${stats.joined}/${COUNT} · claims ${stats.claimed} · rejected ${stats.rejected} · powerups ${stats.powers}   `,
  );
}, 1000);

function shutdown() {
  clearInterval(statusTimer);
  console.log('\n[botsim] disconnecting bots…');
  for (const b of bots) {
    for (const t of b.timers) clearInterval(t);
    b.socket.close();
  }
  setTimeout(() => process.exit(0), 400);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
