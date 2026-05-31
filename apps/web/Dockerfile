# syntax=docker/dockerfile:1
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

# ── build: install workspace, produce a Next standalone bundle ──
FROM base AS build
# NEXT_PUBLIC_* is inlined into the client bundle at build time, so it must be
# present here (NOT just at runtime).
ARG NEXT_PUBLIC_SOCKET_URL=http://localhost:4000
ENV NEXT_PUBLIC_SOCKET_URL=${NEXT_PUBLIC_SOCKET_URL}
ENV NEXT_TELEMETRY_DISABLED=1
ENV BUILD_STANDALONE=1
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/web/package.json ./apps/web/
COPY apps/server/package.json ./apps/server/
RUN pnpm install --no-frozen-lockfile
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web
RUN pnpm --filter @ctb/web build

# ── dev: hot-reload via next dev (used by docker-compose.dev.yml) ──
FROM build AS dev
ENV NODE_ENV=development
CMD ["pnpm", "--filter", "@ctb/web", "exec", "next", "dev", "-p", "3000", "-H", "0.0.0.0"]

# ── runtime: minimal production image from the standalone output ──
FROM base AS runtime
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
