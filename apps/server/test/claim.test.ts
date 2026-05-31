import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { LOCK_MS } from '@ctb/shared';
import { KEYS, redis, closeRedis } from '../src/redis';
import { claim, computeLeaderboard, getTiles, registerUser } from '../src/gameService';

/**
 * These exercise the atomic claim engine against the exact edge cases the
 * design hinges on. They need a real Redis at REDIS_URL (default localhost:6379)
 * — e.g. `docker compose up -d redis` first.
 */
async function flush() {
  const keys = await redis.keys('ctb:*');
  if (keys.length) await redis.del(...keys);
}

beforeEach(flush);
afterAll(async () => {
  await flush();
  await closeRedis();
});

describe('claim engine', () => {
  it('claims an unclaimed tile and scores it', async () => {
    await registerUser({ id: 'A', name: 'Ann', color: 'mint' });
    const r = await claim('A', 5, 'mint');
    expect(r.ok).toBe(true);

    const tiles = await getTiles();
    expect(tiles).toHaveLength(1);
    expect(tiles[0]).toMatchObject({ id: 5, owner: 'A', color: 'mint' });
    expect(await redis.zscore(KEYS.lb, 'A')).toBe('1');
  });

  it('rejects a second claim while on cooldown', async () => {
    await claim('A', 1, 'mint');
    const r = await claim('A', 2, 'mint');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe('cooldown');
      expect(r.remainingMs).toBeGreaterThan(0);
    }
  });

  it('transfers ownership and cleans up the previous owner (no zero-score ghost)', async () => {
    await registerUser({ id: 'A', name: 'Ann', color: 'mint' });
    await registerUser({ id: 'B', name: 'Bob', color: 'sky' });

    await claim('A', 10, 'mint');
    await redis.del(KEYS.lock(10)); // drop the shield so B can take it immediately
    const r = await claim('B', 10, 'sky'); // different user => no cooldown clash
    expect(r.ok).toBe(true);

    const tiles = await getTiles();
    expect(tiles[0]).toMatchObject({ owner: 'B' });
    expect(await redis.zscore(KEYS.lb, 'B')).toBe('1');
    expect(await redis.zscore(KEYS.lb, 'A')).toBeNull(); // removed, not left at 0
  });

  it('does not double-count a self-overwrite', async () => {
    await claim('A', 7, 'mint');
    await redis.del(KEYS.cd('A')); // clear cooldown to allow an immediate re-claim
    const r = await claim('A', 7, 'blush');
    expect(r.ok).toBe(true);
    expect(await redis.zscore(KEYS.lb, 'A')).toBe('1'); // still 1, not 2

    const tiles = await getTiles();
    expect(tiles[0]).toMatchObject({ owner: 'A', color: 'blush' });
  });

  it('shields a freshly captured tile from other users (lock)', async () => {
    await claim('A', 3, 'mint');
    const r = await claim('B', 3, 'sky'); // blocked by the fresh shield
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe('locked');
      expect(r.remainingMs).toBeGreaterThan(0);
      expect(r.remainingMs).toBeLessThanOrEqual(LOCK_MS);
    }
  });

  it('issues strictly increasing seq versions', async () => {
    const r1 = await claim('A', 1, 'mint');
    const r2 = await claim('B', 2, 'sky');
    expect(r1.ok && r2.ok).toBe(true);
    if (r1.ok && r2.ok) expect(r2.tile.seq).toBeGreaterThan(r1.tile.seq);
  });

  it('reports the largest contiguous cluster (area control)', async () => {
    await registerUser({ id: 'A', name: 'Ann', color: 'mint' });
    await claim('A', 0, 'mint'); // (col 0, row 0)
    await redis.del(KEYS.cd('A'));
    await claim('A', 1, 'mint'); // (col 1, row 0) — adjacent => one cluster of 2

    const lb = await computeLeaderboard();
    expect(lb[0]).toMatchObject({ userId: 'A', tiles: 2, largestCluster: 2 });
  });
});
