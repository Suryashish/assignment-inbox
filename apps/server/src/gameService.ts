import {
  COOLDOWN_MS,
  LOCK_MS,
  GRID_COLS,
  GRID_ROWS,
  LEADERBOARD_SIZE,
  TILE_COUNT,
  type ClaimedTile,
  type ClaimResult,
  type LeaderboardEntry,
  type Snapshot,
  type User,
} from '@ctb/shared';
import { KEYS, redis, type ClaimRaw } from './redis';

interface StoredTile {
  owner: string;
  color: string;
  seq: number;
}

/** Persist a user's display identity so the leaderboard can resolve names. */
export async function registerUser(user: User): Promise<void> {
  await redis.hset(KEYS.users, user.id, JSON.stringify({ name: user.name, color: user.color }));
}

export async function getUser(userId: string): Promise<{ name: string; color: string } | null> {
  const raw = await redis.hget(KEYS.users, userId);
  return raw ? (JSON.parse(raw) as { name: string; color: string }) : null;
}

/**
 * Attempt to capture a tile. All correctness lives in the atomic Lua script;
 * here we just translate its raw reply into a typed result.
 */
export async function claim(userId: string, tileId: number, color: string): Promise<ClaimResult> {
  const res = (await redis.claimTile(
    KEYS.grid,
    KEYS.lb,
    KEYS.cd(userId),
    KEYS.seq,
    KEYS.lock(tileId),
    String(tileId),
    userId,
    color,
    COOLDOWN_MS,
    LOCK_MS,
  )) as ClaimRaw;

  if (res[0] === 1) {
    const seq = res[1] as number;
    return { ok: true, tile: { id: tileId, owner: userId, color, seq } };
  }

  const reason = res[1] as 'cooldown' | 'locked';
  const remainingMs = res[2] as number;
  return { ok: false, reason, remainingMs };
}

/** All currently-claimed tiles (unclaimed is the implicit default). */
export async function getTiles(): Promise<ClaimedTile[]> {
  const raw = await redis.hgetall(KEYS.grid);
  const tiles: ClaimedTile[] = [];
  for (const [id, value] of Object.entries(raw)) {
    try {
      const t = JSON.parse(value) as StoredTile;
      tiles.push({ id: Number(id), owner: t.owner, color: t.color, seq: t.seq });
    } catch {
      // skip corrupt entry rather than crash the snapshot
    }
  }
  return tiles;
}

export async function getSeq(): Promise<number> {
  const v = await redis.get(KEYS.seq);
  return v ? Number(v) : 0;
}

/**
 * Largest contiguous block per owner (4-connectivity) — the area-control stat.
 * Single O(TILE_COUNT) pass over the board: BFS each unvisited claimed tile.
 */
function largestClusters(tiles: ClaimedTile[]): Map<string, number> {
  const ownerByTile = new Array<string | undefined>(TILE_COUNT);
  for (const t of tiles) ownerByTile[t.id] = t.owner;

  const visited = new Uint8Array(TILE_COUNT);
  const best = new Map<string, number>();
  const queue: number[] = [];

  for (let start = 0; start < TILE_COUNT; start++) {
    const owner = ownerByTile[start];
    if (owner === undefined || visited[start]) continue;

    let size = 0;
    queue.length = 0;
    queue.push(start);
    visited[start] = 1;

    while (queue.length) {
      const id = queue.pop()!;
      size++;
      const col = id % GRID_COLS;
      const row = (id - col) / GRID_COLS;
      // 4 neighbors, same owner, in-bounds, unvisited
      if (col > 0) maybePush(id - 1);
      if (col < GRID_COLS - 1) maybePush(id + 1);
      if (row > 0) maybePush(id - GRID_COLS);
      if (row < GRID_ROWS - 1) maybePush(id + GRID_COLS);
    }

    best.set(owner, Math.max(best.get(owner) ?? 0, size));

    function maybePush(n: number) {
      if (!visited[n] && ownerByTile[n] === owner) {
        visited[n] = 1;
        queue.push(n);
      }
    }
  }
  return best;
}

/**
 * Top-N leaderboard. Counts come from the sorted set (cheap, ranked); cluster
 * sizes + display names are resolved against the tile snapshot + users hash.
 */
export async function computeLeaderboard(tiles?: ClaimedTile[]): Promise<LeaderboardEntry[]> {
  const board = tiles ?? (await getTiles());
  const top = await redis.zrevrange(KEYS.lb, 0, LEADERBOARD_SIZE - 1, 'WITHSCORES');
  if (top.length === 0) return [];

  const clusters = largestClusters(board);

  // top = [member, score, member, score, ...]
  const userIds: string[] = [];
  const counts: number[] = [];
  for (let i = 0; i < top.length; i += 2) {
    userIds.push(top[i]!);
    counts.push(Number(top[i + 1]));
  }

  const metas = userIds.length ? await redis.hmget(KEYS.users, ...userIds) : [];

  return userIds.map((userId, i) => {
    let name = 'anon';
    let color = 'periwinkle';
    const metaRaw = metas[i];
    if (metaRaw) {
      try {
        const meta = JSON.parse(metaRaw) as { name: string; color: string };
        name = meta.name;
        color = meta.color;
      } catch {
        /* keep defaults */
      }
    }
    return {
      userId,
      name,
      color,
      tiles: counts[i]!,
      largestCluster: clusters.get(userId) ?? 0,
    };
  });
}

/** Full state for a joining (or reconnecting) client. */
export async function getSnapshot(online: number): Promise<Snapshot> {
  const tiles = await getTiles();
  const [leaderboard, seq] = await Promise.all([computeLeaderboard(tiles), getSeq()]);
  return {
    config: { cols: GRID_COLS, rows: GRID_ROWS, cooldownMs: COOLDOWN_MS, lockMs: LOCK_MS },
    tiles,
    online,
    leaderboard,
    seq,
  };
}
