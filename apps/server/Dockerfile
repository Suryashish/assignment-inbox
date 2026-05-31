# syntax=docker/dockerfile:1
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

# ── build: install workspace, compile server, prune a prod bundle ──
FROM base AS build
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/server/package.json ./apps/server/
COPY apps/web/package.json ./apps/web/
RUN pnpm install --no-frozen-lockfile
COPY packages/shared ./packages/shared
COPY apps/server ./apps/server
RUN pnpm --filter @ctb/server build
# pnpm deploy emits a self-contained dir (dist + prod node_modules).
RUN pnpm --filter @ctb/server deploy --prod /deploy

# ── dev: hot-reload via tsx watch (used by docker-compose.dev.yml) ──
FROM build AS dev
ENV NODE_ENV=development
CMD ["pnpm", "--filter", "@ctb/server", "dev"]

# ── runtime: minimal production image ──
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /deploy ./
EXPOSE 4000
CMD ["node", "dist/index.js"]
