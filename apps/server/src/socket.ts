import { nanoid } from 'nanoid';
import {
  COOLDOWN_MS,
  EVENTS,
  GRID_COLS,
  GRID_ROWS,
  LOCK_MS,
  isValidColor,
  isValidName,
  isValidTileId,
  sanitizeName,
  type Snapshot,
} from '@ctb/shared';
import { KEYS, redis } from './redis';
import { claim, getSnapshot, registerUser, resetBoard } from './gameService';
import { TokenBucket, isLoopback } from './rateLimit';
import type { IO, IOSocket } from './ioTypes';

const USERID_RE = /^[A-Za-z0-9_-]{6,40}$/;

// Abuse limits (defense in depth alongside the per-user Lua cooldown):
//  • per-socket token bucket — bounds claims/sec on a single connection, even if
//    it rapidly re-joins to cycle userIds and dodge the per-user cooldown.
//  • per-IP connection cap — stops one host opening unlimited sockets.
const BUCKET_CAPACITY = 60;
const BUCKET_REFILL_PER_SEC = 60; // comfortably above legit single-user play
const MAX_CONN_PER_IP = 20;

const buckets = new Map<string, TokenBucket>();
const ipConnections = new Map<string, number>();

export function registerSocketHandlers(io: IO): void {
  io.on('connection', (socket: IOSocket) => {
    const ip = socket.handshake.address || 'unknown';

    // Per-IP connection cap (loopback exempt so local multi-tab dev isn't blocked).
    if (!isLoopback(ip)) {
      const count = (ipConnections.get(ip) ?? 0) + 1;
      if (count > MAX_CONN_PER_IP) {
        socket.disconnect(true);
        return;
      }
      ipConnections.set(ip, count);
    }
    buckets.set(socket.id, new TokenBucket(BUCKET_CAPACITY, BUCKET_REFILL_PER_SEC));

    schedulePresence(io);

    socket.on('join', async (payload, ack) => {
      try {
        const name = isValidName(payload?.name) ? sanitizeName(payload.name) : 'player';
        const color = isValidColor(payload?.color) ? payload.color : 'periwinkle';
        const userId =
          payload?.userId && USERID_RE.test(payload.userId) ? payload.userId : nanoid();

        socket.data.userId = userId;
        socket.data.name = name;
        socket.data.color = color;

        await registerUser({ id: userId, name, color });
        const snapshot = await getSnapshot(io.engine.clientsCount);
        ack({ userId, snapshot });
      } catch {
        ack({ userId: socket.data.userId ?? nanoid(), snapshot: emptySnapshot(io.engine.clientsCount) });
      }
    });

    socket.on('claim', async (payload, ack) => {
      const { userId, color } = socket.data;
      if (!userId || !color) return ack({ ok: false, reason: 'invalid' });
      if (!payload || !isValidTileId(payload.tileId)) return ack({ ok: false, reason: 'invalid' });

      const bucket = buckets.get(socket.id);
      if (bucket && !bucket.take()) return ack({ ok: false, reason: 'invalid' });

      try {
        const result = await claim(userId, payload.tileId, color);
        ack(result);
        if (result.ok) {
          // Publish the delta; the broadcaster batches it to everyone next tick.
          await redis.publish(KEYS.channel, JSON.stringify(result.tile));
        }
      } catch {
        ack({ ok: false, reason: 'invalid' });
      }
    });

    socket.on('reset', async () => {
      if (!socket.data.userId) return; // must have joined
      try {
        await resetBoard();
        io.emit(EVENTS.boardReset);
        io.emit(EVENTS.leaderboardUpdate, []);
      } catch {
        /* ignore */
      }
    });

    socket.on('disconnect', () => {
      buckets.delete(socket.id);
      if (!isLoopback(ip)) {
        const count = (ipConnections.get(ip) ?? 1) - 1;
        if (count <= 0) ipConnections.delete(ip);
        else ipConnections.set(ip, count);
      }
      schedulePresence(io);
    });
  });
}

/** Debounce presence so connect/disconnect storms collapse into one broadcast. */
let presenceTimer: ReturnType<typeof setTimeout> | null = null;
function schedulePresence(io: IO): void {
  if (presenceTimer) return;
  presenceTimer = setTimeout(() => {
    presenceTimer = null;
    io.emit(EVENTS.presenceUpdate, { online: io.engine.clientsCount });
  }, 120);
}

function emptySnapshot(online: number): Snapshot {
  return {
    config: { cols: GRID_COLS, rows: GRID_ROWS, cooldownMs: COOLDOWN_MS, lockMs: LOCK_MS },
    tiles: [],
    online,
    leaderboard: [],
    seq: 0,
  };
}
