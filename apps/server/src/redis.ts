import Redis from 'ioredis';
import { config } from './config';
import { CLAIM_LUA } from './claimScript';

/** Namespaced Redis keys — one place so nothing drifts. */
export const KEYS = {
  grid: 'ctb:grid',
  lb: 'ctb:lb',
  seq: 'ctb:seq',
  users: 'ctb:users',
  channel: 'ctb:tile-changes',
  cd: (userId: string) => `ctb:cd:${userId}`,
  lock: (tileId: number) => `ctb:lock:${tileId}`,
} as const;

/**
 * Raw return of the claim script:
 *   [1, seq]                      -> success
 *   [0, 'cooldown'|'locked', ttl] -> rejected
 */
export type ClaimRaw = [number, number] | [number, string, number];

// ioredis custom commands aren't typed out of the box — declare ours.
interface CtbRedis extends Redis {
  claimTile(
    gridKey: string,
    lbKey: string,
    cdKey: string,
    seqKey: string,
    lockKey: string,
    tileId: string,
    userId: string,
    color: string,
    cooldownMs: number,
    lockMs: number,
  ): Promise<ClaimRaw>;
}

const commonOpts = { maxRetriesPerRequest: null as null, enableReadyCheck: true };

/** Main connection — commands + publish. */
export const redis = new Redis(config.redisUrl, commonOpts) as CtbRedis;

/** A second connection dedicated to SUBSCRIBE (a subscribed conn can't issue normal commands). */
export const subscriber = new Redis(config.redisUrl, commonOpts);

// Register the atomic claim as a custom command (ioredis manages EVALSHA caching).
redis.defineCommand('claimTile', { numberOfKeys: 5, lua: CLAIM_LUA });

export async function pingRedis(): Promise<boolean> {
  try {
    return (await redis.ping()) === 'PONG';
  } catch {
    return false;
  }
}

export async function closeRedis(): Promise<void> {
  await Promise.allSettled([redis.quit(), subscriber.quit()]);
}
