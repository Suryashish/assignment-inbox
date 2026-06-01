# Capture the Board

A real-time, multiplayer shared grid. Anyone opens the site, picks a name and a
color, and starts capturing tiles — and **every capture is broadcast to everyone
the instant it happens**. Built to demonstrate backend and real-time thinking
under many concurrent users, wrapped in a polished dark UI with rounds, power-ups,
live cursors, and a leaderboard.

```
        Browser tab                       Browser tab                Browser tab
            │                                  │                          │
            └──────────────┬───────────────────┴──────────────┬──────────┘
                           │   WebSocket (Socket.IO)           │
            ┌──────────────▼───────────────────────────────────▼──────────┐
            │                     apps/server  (Node)                       │
            │                                                               │
            │  socket handlers ── validate · token-bucket · per-IP cap     │
            │        │                                                      │
            │        ▼                                                      │
            │   gameService ──► atomic claim (Redis Lua)                    │
            │        │              │                                       │
            │        │              └─ publish delta ──► Redis pub/sub      │
            │        │                                        │             │
            │   roundManager   powerups    broadcaster ◄──────┘             │
            │   (match loop)   (spawn/fx)  (tick-batched fan-out, ~60 ms)   │
            └───────────────────────────┬──────────────────────────────────┘
                                        │  state · cooldown · lock ·
                                ┌───────▼────────┐  leaderboard · pub/sub
                                │  Redis (AOF)   │  wins · power-ups
                                └────────────────┘  (durable across restarts)
```

A pnpm monorepo: a **Next.js** client, a **Node + Socket.IO** server, and a
**shared typed contract** package that both ends import so events, domain types,
and constants can never drift.

---

## Quick start (Docker — runs everything)

```bash
docker compose up --build
```

- **Web** → http://localhost:3000
- **Server** → http://localhost:4000 (health: `/health`)
- **Redis** → localhost:6379 (AOF persistence in a named volume)

Open the site in **two or more browser tabs/windows**, join with different
names/colors, and click tiles — captures appear everywhere instantly.

### Local dev (fast inner loop)

```bash
docker compose up -d redis      # just Redis in a container
pnpm install
pnpm dev                        # server (tsx watch) + web (next dev), concurrently
```

### Docker dev with hot reload

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

**Requirements:** Node ≥ 20, pnpm 9, and Redis (the Docker flows provide Redis
for you).

---

## Architecture

### The three pieces

| Package | What it is | Responsibility |
| --- | --- | --- |
| [`packages/shared`](packages/shared) | The typed contract | Socket.IO event maps, domain types, and all game constants/palette. Imported by **both** client and server, so a shape change is a compile error, not a runtime surprise. |
| [`apps/server`](apps/server) | Node + Express + Socket.IO + Redis | The authority: validates input, runs the atomic claim, batches the broadcast, drives rounds + power-ups. Holds **no** in-process game state — Redis is the source of truth. |
| [`apps/web`](apps/web) | Next.js (App Router) + React 19 | The client: optimistic painting, seq reconciliation, the board, the HUD, and the premium UI. |

### Server module map ([`apps/server/src`](apps/server/src))

| File | Role |
| --- | --- |
| [`index.ts`](apps/server/src/index.ts) | Boot: Express `/health`, Socket.IO server, starts the broadcaster + round + power-up loops, graceful shutdown. |
| [`socket.ts`](apps/server/src/socket.ts) | Connection lifecycle and the `join` / `claim` / `cursor` / `reset` handlers. Input validation + abuse guards live here. |
| [`gameService.ts`](apps/server/src/gameService.ts) | The game operations: `claim`, snapshot building, leaderboard compute (incl. flood-fill clusters), board reset. |
| [`claimScript.ts`](apps/server/src/claimScript.ts) | The **atomic claim Lua** (and a batch `claimMany` for power-up areas). The correctness core. |
| [`broadcaster.ts`](apps/server/src/broadcaster.ts) | Subscribes to the Redis delta channel and flushes one coalesced `tiles:update` (and throttled `cursors:update`) per tick. |
| [`roundManager.ts`](apps/server/src/roundManager.ts) | The match loop: timed rounds, crown the leader, persist wins, reset, intermission, repeat. |
| [`powerups.ts`](apps/server/src/powerups.ts) | Spawns/despawns power-up tiles and applies their effects (bomb / burst / shield). |
| [`redis.ts`](apps/server/src/redis.ts) | The two Redis connections (commands + a dedicated subscriber), key namespace, custom-command registration. |
| [`rateLimit.ts`](apps/server/src/rateLimit.ts) | A token bucket + loopback check — the per-socket / per-IP abuse defenses. |
| [`config.ts`](apps/server/src/config.ts) | Runtime config from env with local defaults (`PORT`, `REDIS_URL`, `CORS_ORIGIN`, `ROUND_MS`). |
| [`loadtest.ts`](apps/server/src/loadtest.ts) · [`botsim.ts`](apps/server/src/botsim.ts) | A concurrency/bounded-broadcast load harness, and a bot simulator for eyeballing the board under load. |

### Web module map ([`apps/web/src`](apps/web/src))

| Path | Role |
| --- | --- |
| [`hooks/useGameSocket.ts`](apps/web/src/hooks/useGameSocket.ts) | Wires the shared socket to the stores; buffers tile batches into a single `requestAnimationFrame` so a burst is one render. |
| [`store/gridStore.ts`](apps/web/src/store/gridStore.ts) | Zustand store of authoritative tiles + optimistic overlay; applies updates only when `seq` is newer. |
| [`store/sessionStore.ts`](apps/web/src/store/sessionStore.ts) | Identity, connection state, leaderboard, presence, round, cursors, activity feed, mute. |
| [`lib/socket.ts`](apps/web/src/lib/socket.ts) · [`lib/actions.ts`](apps/web/src/lib/actions.ts) | The singleton Socket.IO client and the emit helpers (join, claim, cursor, reset). |
| [`lib/sfx.ts`](apps/web/src/lib/sfx.ts) | Synthesized Web-Audio sound effects (no assets) + haptics. |
| [`components/board`](apps/web/src/components/board) | The DOM grid, per-tile component, cursor layer, power-up layer, zoom/pan, parallax backdrop. |
| [`components/hud`](apps/web/src/components/hud) | Leaderboard, round timer, combo meter, activity feed, confetti, top bar, mobile stats. |
| [`components/join`](apps/web/src/components/join) | The name/color join screen and its backdrop. |

### The Redis data model

One Redis instance is the entire backing store — state, timers, ranking, and the
message bus — which keeps the operational surface tiny. Keys
([`redis.ts`](apps/server/src/redis.ts)):

| Key | Type | Holds |
| --- | --- | --- |
| `ctb:grid` | Hash | `tileId → {owner, color, seq}` — only claimed tiles (unclaimed is the implicit default). |
| `ctb:lb` | Sorted set | `userId → tiles owned` — cheap ranked leaderboard counts. |
| `ctb:seq` | Counter | Monotonic version source; every claim does `INCR`, immune to clock skew. |
| `ctb:cd:<userId>` | String + TTL | Per-user cooldown; its `PTTL` is the exact remaining ms. |
| `ctb:lock:<tileId>` | String + TTL | A freshly captured tile's shield window. |
| `ctb:users` | Hash | `userId → {name, color}` so the leaderboard can resolve display identity. |
| `ctb:wins` | Hash | `userId → round wins` — persists across rounds. |
| `ctb:power` | Hash | `tileId → power-up type` — live power-ups on the board. |
| `ctb:tile-changes` | Pub/sub | The delta channel the broadcaster fans out from. |

Redis is configured with **AOF** persistence, so the board survives a restart.

---

## How it works

### The claim — atomic and race-free, in one Redis Lua script
Every capture runs through [`claimScript.ts`](apps/server/src/claimScript.ts).
Redis is single-threaded, so the whole script executes **atomically** — no two
claims can interleave. That one fact removes the need for app-level locks and
makes simultaneous clicks on the same tile resolve deterministically. The script:

1. Rejects if the user is on **cooldown** (returns the exact remaining ms).
2. Rejects if the tile is **freshly shielded** by someone else (lock TTL; a tile's
   owner can always re-touch their own tile).
3. Allocates a monotonic **`seq`** (the version) and writes the tile.
4. Adjusts the **leaderboard** only on a real ownership transfer — no double-count
   on self-overwrite, no phantom decrement on previously-unclaimed tiles, and it
   removes a user from the ranking when their score hits zero.
5. Arms the per-user cooldown and the per-tile shield TTLs.

Power-up effects use a sibling `claimMany` script that claims a whole area
(3×3 or a plus) for one user in a single atomic pass, keeping the same
leaderboard bookkeeping.

### Staying correct under concurrency
- **Server-authoritative** state lives in Redis; the client paints
  **optimistically** for instant feedback, then reconciles on the ack / broadcast.
- Every tile carries a **`seq`**; clients apply an update only if it's newer, so
  out-of-order or concurrent overwrites converge to last-writer-wins
  ([`gridStore.ts`](apps/web/src/store/gridStore.ts)).
- On reconnect the client **fully re-syncs** from a fresh snapshot, discarding any
  stale optimistic state.
- Identity is keyed by a `userId` persisted in `localStorage`, so a refresh keeps
  your tiles and leaderboard standing.

### Scaling the broadcast — the part that actually matters
Naively emitting one message per claim to every client is **O(users²)**
messages/sec — that's what melts at scale, not the language. Instead the
[broadcaster](apps/server/src/broadcaster.ts) buffers changes and flushes **one
coalesced `tiles:update` batch per tick** (~60 ms). Each client then receives a
bounded ~16 messages/sec **no matter how many users are active → O(users)**. The
client applies each batch in a single `requestAnimationFrame`, so a burst of 100
captures is **one React render**, not 100.

Two more throttles keep the wire quiet:
- **Cursors** are emitted at most every other tick (~8 fps) and skipped entirely
  when the live set is byte-for-byte unchanged (coords quantized so sub-pixel
  jitter doesn't defeat the diff).
- The **leaderboard** (an `HGETALL` + flood-fill) recomputes on its own slower
  timer (~700 ms) only when something changed, decoupled from the tile firehose.

Deltas travel over a Redis **pub/sub channel**, and app instances hold no
authoritative state — so scaling out is just *run more instances behind a sticky
load balancer*, no rewrite. The per-user cooldown also acts as a rate governor,
bounding the global write rate.

The load test proves the bounded fan-out — **200 clients, ~9.9 batches/client/sec**
(bounded by the tick, flat as clients grow):

```bash
LOADTEST_CLIENTS=200 LOADTEST_DURATION=12000 pnpm --filter @ctb/server loadtest
```

### Abuse defenses (defense in depth)
Beyond the per-user Lua cooldown, [`socket.ts`](apps/server/src/socket.ts) adds:
- a **per-socket token bucket** (60 cap / 60 per-sec refill) that bounds
  claims/sec on a single connection, even if it rapidly re-joins to cycle
  `userId`s and dodge the per-user cooldown;
- a **per-IP connection cap** (20, loopback exempt so local multi-tab dev works);
- strict validation of every payload (tile id range, name/color, `userId` shape).

### Why these choices
| Concern | Choice | Why |
| --- | --- | --- |
| Frontend | Next.js + React 19 + TS | Clean App-Router client; React 19 + Zustand for fine-grained re-renders. |
| Realtime | Socket.IO (WS, polling fallback) | Acks, auto-reconnect, rooms, adapter-ready for scale-out. |
| Backend | Node + Express (thin `/health`) | I/O-bound fan-out is Node's sweet spot; Express stays off the hot path. |
| State / durability | Redis (AOF) | One component does state + cooldown TTL + lock TTL + leaderboard (sorted set) + atomic Lua + pub/sub + persistence. |
| Rendering | DOM grid, per-tile Zustand selectors | Native glow/shadow/ripple; one tile update re-renders one tile. |
| Monorepo | pnpm workspaces + a shared **typed contract** | Client and server share events/types/constants — no drift. |

---

## Game rules & features
- **Timed rounds** — each round runs `ROUND_MS` (default 2 min, env-overridable)
  with a live synced countdown; at the end the leader is crowned with a
  celebration banner + confetti, the board auto-resets, and the next round
  begins after a short intermission. Round wins persist per player (`ctb:wins`).
- **Power-up tiles** — special tiles spawn/despawn over time; grabbing one fires
  an effect: 💣 **bomb** (claims a 3×3 area), 🌟 **burst** (a plus), 🛡️ **shield**
  (claims a plus and extends the lock so the cluster is hard to steal back).
- **Live cursors** — every player's cursor (name + color) is relayed in board
  space, so the board feels like a crowded arena.
- **Combo + juice** — rapid captures build a combo multiplier with escalating
  feedback; synthesized Web-Audio sound effects (no assets) + mobile haptics on
  capture/grab/win, with a mute toggle.
- **Overwrite + cooldown** — capture any tile; a short, configurable cooldown
  between captures (rate limit + load governor).
- **Lock / shield** — a freshly captured tile is briefly protected from others
  (`LOCK_MS`, default 1.5 s; `0` = pure overwrite).
- **New game** — the **New game** button clears the shared board for everyone and
  starts fresh (server wipes grid/leaderboard, broadcasts `board:reset`).
- **Standings panel** — ranked leaderboard (👑 leader, tiles owned, **largest
  contiguous cluster** via flood-fill, per-player share bars), a **board-control
  bar** (each color's share of the board), and live stats: **% claimed, player
  count, online count, and your rank**.
- **Zoom / pan**, capture ripples, hover glow, cooldown ring, live activity feed,
  animated join → board transition.

All tunables live in
[`packages/shared/src/constants.ts`](packages/shared/src/constants.ts) — grid size
(32×32 = 1024 tiles), cooldown, lock, tick cadence, round length, power-up timing,
and the curated pastel palette.

---

## Project layout
```
capture-the-board/
├─ packages/shared      typed contract: events, domain types, constants, palette
│  └─ src/
│     ├─ contract.ts    Socket.IO event maps (ClientToServer / ServerToClient)
│     ├─ types.ts       domain types (ClaimedTile, Snapshot, RoundState, …)
│     └─ constants.ts   board size, cooldown, lock, tick, palette, validators
├─ apps/server          Socket.IO + Express + Redis
│  └─ src/              (see "Server module map" above)
├─ apps/web             Next.js client
│  └─ src/              (see "Web module map" above)
├─ docker-compose.yml         production-shaped stack (redis + server + web)
├─ docker-compose.dev.yml     hot-reload overlay
└─ RAILWAY.md                 step-by-step Railway deployment guide
```

---

## Configuration

Server env ([`apps/server/src/config.ts`](apps/server/src/config.ts)):

| Variable | Required | Default | Notes |
| --- | --- | --- | --- |
| `PORT` | no | `4000` | Port the server binds. Injected by the host in prod. |
| `REDIS_URL` | yes (prod) | `redis://localhost:6379` | The Redis connection string. |
| `CORS_ORIGIN` | yes (prod) | `http://localhost:3000` | Allowed web origin(s), comma-separated, or `*`. |
| `ROUND_MS` | no | `120000` | Round length in ms (e.g. `5000` for quick testing). |

Web env:

| Variable | Required | Default | Notes |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SOCKET_URL` | yes | `http://localhost:4000` | The server's public URL. **Build-time** — baked into the client bundle, so changing it requires a **rebuild** of the web app, not just a restart. |
| `PORT` | no | `3000` | Port Next.js binds. |

---

## Testing & verification
```bash
docker compose up -d redis
pnpm --filter @ctb/server test     # 7 claim-engine edge-case tests (vitest)
pnpm --filter @ctb/server loadtest # concurrency / bounded-broadcast harness
pnpm --filter @ctb/server botsim   # drive the board with simulated players
```
**Manual smoke test:** open 2+ tabs → claims propagate live; spam-click → cooldown
countdown; two tabs hit the same tile → both converge (seq) and the leaderboard
stays consistent; `docker compose restart redis` → board persists (AOF).

---

## Deployment

The two apps are Dockerized (multi-stage; last stage is `runtime`, the prod
image) and build from the **repo root** so they can see `packages/shared` and the
lockfile.

- **Docker Compose** — `docker compose up --build` runs the whole stack locally.
- **Railway** — full step-by-step guide in [`RAILWAY.md`](RAILWAY.md). Three
  services (managed Redis + server + web), with per-service
  [`railway.json`](apps/server/railway.json) files automating the build config; a
  two-pass URL setup closes the chicken-and-egg between `CORS_ORIGIN` and
  `NEXT_PUBLIC_SOCKET_URL`.

Any host that runs Docker works the same way — the Dockerfiles, ports, and env
vars are platform-agnostic. The only platform-specific subtlety is that
`NEXT_PUBLIC_SOCKET_URL` is a **build arg** (the web `Dockerfile` declares
`ARG NEXT_PUBLIC_SOCKET_URL`), so it must be passed at build time.

---

## Notes & trade-offs
- **Single server instance by default;** horizontal scale-out is designed-in
  (stateless instances + Redis pub/sub) but not operated here. Multiple instances
  would need a sticky load balancer (and Socket.IO's Redis adapter if you fan out
  emits cross-instance).
- **Curated pastel palette** instead of free color picking — keeps the board
  cohesive and bounds name/color collisions (identity is keyed by `userId`).
- `output: 'standalone'` for the web image is gated behind `BUILD_STANDALONE`
  (set in the Dockerfile) because the trace step uses symlinks that some Windows
  hosts block — local `next build` and Linux Docker builds both work.
