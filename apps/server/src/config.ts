/** Runtime config from env, with sensible local defaults. */
function parseOrigins(raw: string | undefined): string[] | '*' {
  if (!raw || raw === '*') return '*';
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  corsOrigin: parseOrigins(process.env.CORS_ORIGIN ?? 'http://localhost:3000'),
} as const;
