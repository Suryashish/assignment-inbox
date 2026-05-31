/**
 * Concurrency / load harness — the headline scalability check.
 *
 * Spawns N socket clients that each join and then claim a random tile roughly
 * once per cooldown. It prints, among other things, *messages received per
 * client per second*. The whole point of the tick-batched broadcaster is that
 * this number stays bounded (~`1000/TICK_MS`) no matter how many clients you
 * run — proving fan-out is O(users), not O(users²).
 *
 *   pnpm --filter @ctb/server loadtest
 *   LOADTEST_CLIENTS=400 LOADTEST_DURATION=20000 pnpm --filter @ctb/server loadtest
 */
import { io as connect, type Socket } from 'socket.io-client';
import {
  COOLDOWN_MS,
  PALETTE,
  TILE_COUNT,
  type ClaimResult,
  type ClaimedTile,
  type ClientToServerEvents,
  type JoinResult,
  type ServerToClientEvents,
} from '@ctb/shared';

const URL = process.env.LOADTEST_URL ?? 'http://localhost:4000';
const CLIENTS = Number(process.env.LOADTEST_CLIENTS ?? 200);
const DURATION_MS = Number(process.env.LOADTEST_DURATION ?? 15_000);

type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
const sockets: ClientSocket[] = [];

const stats = { connected: 0, joined: 0, claimsOk: 0, claimsRejected: 0, batches: 0, tiles: 0 };
const rand = (n: number) => Math.floor(Math.random() * n);

function spawn(i: number) {
  const socket: ClientSocket = connect(URL, { transports: ['websocket'], forceNew: true });
  sockets.push(socket);

  socket.on('connect', () => {
    stats.connected++;
    const color = PALETTE[rand(PALETTE.length)]!.id;
    socket.emit('join', { name: `bot-${i}`, color }, (_res: JoinResult) => {
      stats.joined++;
      const timer = setInterval(() => {
        socket.emit('claim', { tileId: rand(TILE_COUNT) }, (res: ClaimResult) => {
          if (res.ok) stats.claimsOk++;
          else stats.claimsRejected++;
        });
      }, COOLDOWN_MS + 50 + rand(400));
      socket.on('disconnect', () => clearInterval(timer));
    });
  });

  socket.on('tiles:update', (batch: ClaimedTile[]) => {
    stats.batches++;
    stats.tiles += batch.length;
  });
}

console.log(`[loadtest] ${CLIENTS} clients → ${URL} for ${DURATION_MS}ms`);
for (let i = 0; i < CLIENTS; i++) spawn(i);

setTimeout(() => {
  const secs = DURATION_MS / 1000;
  const perClientSec = stats.connected ? stats.batches / stats.connected / secs : 0;
  console.log('──────────── results ────────────');
  console.log(`connected:         ${stats.connected}/${CLIENTS}`);
  console.log(`joined:            ${stats.joined}/${CLIENTS}`);
  console.log(`claims accepted:   ${stats.claimsOk}`);
  console.log(`claims rejected:   ${stats.claimsRejected}  (cooldown / lock / flood-guard)`);
  console.log(`batches received:  ${stats.batches} total`);
  console.log(`  → per client/sec: ${perClientSec.toFixed(2)}  (should stay bounded by the tick)`);
  console.log(`tiles applied:     ${stats.tiles}`);
  for (const s of sockets) s.close();
  setTimeout(() => process.exit(0), 500);
}, DURATION_MS);
