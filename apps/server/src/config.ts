/** Runtime config from env, with sensible local defaults. */
function parseOrigins(raw: string | undefined): string[] | '*' {
  if (!raw || raw === '*') return '*';
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

import { ROUND_MS } from '@ctb/shared';

export const config = {
  port: Number(process.env.PORT ?? 4000),
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  corsOrigin: parseOrigins(process.env.CORS_ORIGIN ?? 'http://localhost:3000'),
  // Round length — overridable for testing (e.g. ROUND_MS=5000).
  roundMs: Number(process.env.ROUND_MS ?? ROUND_MS),
} as const;
