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
import type { IO, IOSocket } from './ioTypes';

/** Per-socket flood guard. Cheap defense; the Lua cooldown is the real authority. */
const CLAIM_MIN_INTERVAL_MS = 180;
const USERID_RE = /^[A-Za-z0-9_-]{6,40}$/;

export function registerSocketHandlers(io: IO): void {
  io.on('connection', (socket: IOSocket) => {
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

      const now = Date.now();
      if (socket.data.lastClaimAt && now - socket.data.lastClaimAt < CLAIM_MIN_INTERVAL_MS) {
        return ack({ ok: false, reason: 'invalid' });
      }
      socket.data.lastClaimAt = now;

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

    socket.on('disconnect', () => schedulePresence(io));
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
