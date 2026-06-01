import {
  EVENTS,
  GRID_COLS,
  GRID_ROWS,
  LOCK_MS,
  MAX_POWERUPS,
  POWERUP_SPAWN_MS,
  POWERUP_TTL_MS,
  TILE_COUNT,
  fromTileId,
  toTileId,
  type ClaimedTile,
  type PowerUp,
  type PowerUpType,
} from '@ctb/shared';
import { KEYS, redis } from './redis';
import type { IO } from './ioTypes';

const TYPES: PowerUpType[] = ['bomb', 'burst', 'shield'];
const despawnTimers = new Map<number, ReturnType<typeof setTimeout>>();

export async function getPowerups(): Promise<PowerUp[]> {
  const raw = await redis.hgetall(KEYS.power);
  return Object.entries(raw).map(([tileId, type]) => ({ tileId: Number(tileId), type: type as PowerUpType }));
}

/** Tiles affected by a power-up centered on `tileId` (clamped to the board). */
function affectedTiles(tileId: number, type: PowerUpType): number[] {
  const { col, row } = fromTileId(tileId);
  const ids: number[] = [];
  const push = (c: number, r: number) => {
    if (c >= 0 && c < GRID_COLS && r >= 0 && r < GRID_ROWS) ids.push(toTileId(c, r));
  };
  if (type === 'bomb') {
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) push(col + dc, row + dr);
  } else {
    // burst + shield: a plus shape (center + 4 orthogonal)
    push(col, row);
    push(col - 1, row);
    push(col + 1, row);
    push(col, row - 1);
    push(col, row + 1);
  }
  return ids;
}

/**
 * Atomically claim a power-up tile if it's still there. Returns the type if THIS
 * caller grabbed it (HDEL returns 1 for exactly one winner), else null.
 */
export async function consumePowerupAt(tileId: number): Promise<PowerUpType | null> {
  const type = (await redis.hget(KEYS.power, String(tileId))) as PowerUpType | null;
  if (!type) return null;
  const removed = await redis.hdel(KEYS.power, String(tileId));
  if (removed === 0) return null; // someone else grabbed it first
  const timer = despawnTimers.get(tileId);
  if (timer) {
    clearTimeout(timer);
    despawnTimers.delete(tileId);
  }
  return type;
}

/**
 * Apply a grabbed power-up: claim the affected area for the user (publishing each
 * delta so the broadcaster fans it out), and for `shield` extend the lock so the
 * cluster is hard to steal back.
 */
export async function applyPowerup(
  io: IO,
  userId: string,
  color: string,
  tileId: number,
  type: PowerUpType,
): Promise<void> {
  io.emit(EVENTS.powerDespawn, { tileId });

  const ids = affectedTiles(tileId, type);
  const flat = (await redis.claimMany(KEYS.grid, KEYS.lb, KEYS.seq, userId, color, ...ids)) as (
    | string
    | number
  )[];

  for (let i = 0; i < flat.length; i += 2) {
    const tile: ClaimedTile = { id: Number(flat[i]), owner: userId, color, seq: Number(flat[i + 1]) };
    await redis.publish(KEYS.channel, JSON.stringify(tile));
  }

  if (type === 'shield') {
    const pipe = redis.pipeline();
    for (const id of ids) pipe.set(KEYS.lock(id), '1', 'PX', LOCK_MS * 5);
    await pipe.exec();
  }
}

/** Start the spawn loop. Picks a random free tile, broadcasts, auto-despawns. */
export function startPowerups(io: IO): () => void {
  let stopped = false;

  const trySpawn = async () => {
    if (stopped) return;
    try {
      if ((await redis.hlen(KEYS.power)) >= MAX_POWERUPS) return;
      // find a free tile (unclaimed + no existing power-up); a few attempts
      for (let attempt = 0; attempt < 8; attempt++) {
        const id = Math.floor(Math.random() * TILE_COUNT);
        const [claimed, isPower] = await Promise.all([
          redis.hexists(KEYS.grid, String(id)),
          redis.hexists(KEYS.power, String(id)),
        ]);
        if (!claimed && !isPower) {
          const type = TYPES[id % TYPES.length]!;
          await redis.hset(KEYS.power, String(id), type);
          io.emit(EVENTS.powerSpawn, { tileId: id, type });
          const timer = setTimeout(async () => {
            despawnTimers.delete(id);
            const removed = await redis.hdel(KEYS.power, String(id));
            if (removed) io.emit(EVENTS.powerDespawn, { tileId: id });
          }, POWERUP_TTL_MS);
          despawnTimers.set(id, timer);
          return;
        }
      }
    } catch {
      /* ignore transient */
    }
  };

  const interval = setInterval(trySpawn, POWERUP_SPAWN_MS);
  setTimeout(trySpawn, 2500); // one shortly after boot

  return () => {
    stopped = true;
    clearInterval(interval);
    for (const t of despawnTimers.values()) clearTimeout(t);
    despawnTimers.clear();
  };
}

/** Clear all power-ups (called on board reset / round change). */
export async function clearPowerups(io: IO): Promise<void> {
  const ids = (await redis.hkeys(KEYS.power)).map(Number);
  for (const t of despawnTimers.values()) clearTimeout(t);
  despawnTimers.clear();
  if (ids.length) await redis.del(KEYS.power);
  for (const id of ids) io.emit(EVENTS.powerDespawn, { tileId: id });
}
