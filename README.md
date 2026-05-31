# Capture the Board

A real-time shared grid. Anyone opens the site, picks a name + color, and starts
capturing tiles — and **every capture is broadcast to everyone the instant it
happens**. Built to show backend + real-time thinking under many concurrent
users, wrapped in a sleek dark UI.

```
┌── apps/web  (Next.js + React) ──┐        ┌── apps/server (Node + Socket.IO) ──┐
│  Zustand store (optimistic +    │  WS    │  socket handlers + flood guard      │
│  seq reconciliation)            │ <────> │  broadcaster (tick-batched fan-out) │
│  DOM grid, per-tile selectors   │        │  gameService                        │
└─────────────────────────────────┘        └──────────────┬──────────────────────┘
                                                           │  atomic Lua + pub/sub
                                                  ┌────────▼────────┐
                                                  │  Redis (AOF)    │  state · cooldown ·
                                                  │                 │  lock · leaderboard
                                                  └─────────────────┘
```

---

## Quick start (Docker — runs everything)

```bash
docker compose up --build
```

- Web → http://localhost:3000
- Server → http://localhost:4000 (`/health`)
- Redis → localhost:6379 (AOF persistence in a named volume)

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

---

## How it works

### The claim — atomic, race-free, in one Redis Lua script
Every capture runs through [`apps/server/src/claimScript.ts`](apps/server/src/claimScript.ts).
Redis is single-threaded, so the whole script executes **atomically** — no two
claims can interleave. That one fact removes the need for app-level locks and
makes simultaneous clicks on the same tile resolve deterministically. The script:

1. Rejects if the user is on **cooldown** (returns the exact remaining ms).
2. Rejects if the tile is **freshly shielded** by someone else (lock TTL).
3. Allocates a monotonic **`seq`** (the version), writes the tile.
4. Adjusts the **leaderboard** only on a real ownership transfer (no double-count
   on self-overwrite, no phantom decrement on unclaimed tiles, removes zero scores).
5. Arms the cooldown + lock TTLs.

### Staying correct under concurrency
- **Server-authoritative** state in Redis; the client paints **optimistically** for
  instant feedback, then reconciles on the ack.
- Every tile carries a **`seq`**; clients apply an update only if it's newer, so
  out-of-order or concurrent overwrites converge to last-writer-wins
  ([`gridStore.ts`](apps/web/src/store/gridStore.ts)).
- On reconnect the client **fully re-syncs** from a fresh snapshot, discarding any
  stale optimistic state.
- Identity is keyed by a `userId` persisted in `localStorage`, so a refresh keeps
  your tiles and leaderboard standing.

### Scaling the broadcast — the part that actually matters
Naively emitting one message per claim to every client is **O(users²)** messages/sec
— that's what melts at scale, not the language. Instead the
[broadcaster](apps/server/src/broadcaster.ts) buffers changes and flushes **one
coalesced `tiles:update` batch per tick** (~60 ms). Each client then receives a
bounded ~16 messages/sec **no matter how many users are active → O(users)**. The
client applies each batch in a single `requestAnimationFrame`, so a burst of 100
captures is **one React render**, not 100.

Deltas travel over a Redis **pub/sub channel**, and app instances hold no
authoritative state — so scaling out is just *run more instances behind a sticky
load balancer*, no rewrite. The per-user cooldown also acts as a natural rate
governor, bounding total write rate to ~`users / cooldown`.

The load test proves it — **200 clients, ~9.9 batches/client/sec** (bounded by the
tick, flat as clients grow):

```bash
LOADTEST_CLIENTS=200 LOADTEST_DURATION=12000 pnpm --filter @ctb/server loadtest
```

### Why these choices
| Concern | Choice | Why |
| --- | --- | --- |
| Frontend | Next.js + React + TS | Required; clean App-Router client. |
| Realtime | Socket.IO (WS) | Acks, auto-reconnect, rooms, adapter-ready for scale-out. |
| Backend | Node + Express (thin `/health`) | I/O-bound fan-out is Node's sweet spot; Express is off the hot path. |
| State / durability | Redis (AOF) | One component: state + cooldown TTL + lock TTL + leaderboard (sorted set) + atomic Lua + pub/sub + persistence. |
| Rendering | DOM grid, per-tile Zustand selectors | Native glow/shadow/ripple; one tile update re-renders one tile. |
| Monorepo | pnpm workspaces + a shared **typed contract** | Client and server share event/types/constants — no drift. |

### Game rules & features
- **Overwrite + cooldown** — capture any tile; a short, configurable cooldown
  between captures (rate limit + natural load governor).
- **Lock / shield** — a freshly captured tile is briefly protected from others
  (configurable; `0` = pure overwrite).
- **New game** — the **New game** button clears the shared board for everyone and
  starts fresh (server wipes grid/leaderboard, broadcasts `board:reset`).
- **Leaderboard + stats** — tiles owned, **largest contiguous cluster** (area
  control, via flood-fill), live online count, your tile count.
- **Zoom / pan**, capture ripples, hover glow, cooldown ring, live activity feed,
  animated join → board transition.

All tunables live in [`packages/shared/src/constants.ts`](packages/shared/src/constants.ts)
(grid size, cooldown, lock, tick, palette).

---

## Project layout
```
packages/shared   typed contract: events, domain types, constants, palette
apps/server       Socket.IO + Express + Redis (atomic claim, broadcaster, leaderboard)
apps/web          Next.js client: stores, socket wiring, board, HUD, premium UI
```

## Testing & verification
```bash
docker compose up -d redis
pnpm --filter @ctb/server test     # 7 claim-engine edge-case tests (vitest)
pnpm --filter @ctb/server loadtest # concurrency / bounded-broadcast harness
```
Manual: open 2+ tabs → claims propagate live; spam-click → cooldown countdown;
two tabs hit the same tile → both converge (seq), leaderboard stays consistent;
`docker compose restart redis` → board persists (AOF).

## Notes & trade-offs
- Single server instance by default; horizontal scale-out is designed-in
  (stateless instances + Redis pub/sub) but not operated here.
- Curated pastel palette instead of free color picking — keeps the board cohesive
  and bounds name/color collisions (identity is keyed by `userId`).
- `output: 'standalone'` for the web image is gated behind `BUILD_STANDALONE`
  (set in the Dockerfile) because the trace step uses symlinks that Windows hosts
  block — local `next build` and Linux Docker builds both work.
