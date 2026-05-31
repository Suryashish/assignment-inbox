# Real-Time Shared Grid ("Capture the Board")

## Context

We're building a greenfield, r/place-style **real-time shared grid**: a board of hundreds of blocks where anyone who opens the site picks a name + color, then clicks blocks to capture them. Every capture is broadcast to all connected users instantly over WebSockets. The hard part — and the part being evaluated most — is the **backend + real-time + conflict model under many concurrent users**, paired with a genuinely premium UI (glows, depth shadows, micro-interactions on every interaction).

**Locked decisions (confirmed with user):**
- **Claim rule:** overwrite allowed (anyone can take any tile, even owned) + a per-user **cooldown** (1.5s) for rate-limiting. r/place feel.
- **Identity:** a **join screen** — pick a display name + a color before entering.
- **Persistence:** state **survives a server restart**.
- **Infra:** **Docker Compose** for both local dev and deployment.
- **Color (updated):** not restricted to black & white. Cohesive, sleek **dark theme with curated pastel accents** — colors must harmonize and flow together, never clash.
- **Scale (updated):** must hold up under **a lot of concurrent users** — see the Scalability section, which is now a first-class part of the design.

**Design principles adopted from architecture review:**
- **Atomic claim in a Redis Lua script** — single-threaded Redis serializes all claims; no app-level locking, no leaderboard races.
- **Every tile carries a monotonic `seq`** (server-issued). Clients apply an update only if its `seq` is newer → out-of-order/batched broadcasts and optimistic paints reconcile deterministically (last-writer-wins, clock-skew safe).
- **App instances are stateless** w.r.t. game state — Redis is the only authoritative store; snapshots are read from Redis on connect. This is what makes horizontal scale-out a config change, not a rewrite.
- **Identity keyed by `userId`** (persisted in `localStorage`); name + color are display-only.

---

## Game Rules & Bonus Features Coverage

**Core rules:** overwrite-allowed capture + per-user **cooldown** (`COOLDOWN_MS`, rate limit) + a brief per-tile **lock/shield** on fresh captures (`LOCK_MS`, configurable; set `0` for pure overwrite). Both enforced atomically in `claim.lua`, so they hold under concurrency.

All five brief bonuses are in scope:

| Bonus | Status | Where / how |
|---|---|---|
| **User names or colors** | ✅ | Join screen picks name + a pastel color; identity persisted by `userId` in `localStorage`. |
| **Rules (cooldown, lock time, area control)** | ✅ | Cooldown + per-tile lock/shield enforced in Lua; **area control** surfaced as each user's *largest contiguous cluster*. |
| **Leaderboard / stats** | ✅ | Live leaderboard (tiles owned via sorted set) + largest-cluster stat + online count + your-tiles count. |
| **Zoom / pan for big maps** | ✅ | `react-zoom-pan-pinch` on the grid container; `content-visibility` skips off-screen tiles when zoomed. |
| **Animations / micro-interactions** | ✅ | Capture ripple, hover lift/glow, shield shimmer, cooldown ring, count-up numbers, leaderboard reordering, toasts, animated join→board transition. |

---

## Scalability & Real-Time at Load — *(directly answers "will it handle a lot of users?")*

### Is Node + Express + Socket.IO the right choice? Yes — here's why.
- Real-time fan-out is **I/O-bound**, which is exactly Node's sweet spot. A single Node instance comfortably holds **thousands of concurrent WebSocket connections**.
- **Express is NOT on the hot path.** It's a thin HTTP shell for `/health` and ops only. Every claim travels over the persistent WebSocket — Express adds zero per-claim overhead.
- **Socket.IO** gives us auto-reconnect, acks, rooms, and a clean horizontal-scale adapter. We run the **WebSocket transport only** (disable HTTP long-polling) for efficiency. (If raw connection density ever becomes the limit, Socket.IO's engine can be swapped to **uWebSockets.js**, or we drop to raw `ws` — kept as an option, not needed for the target.)

### The real bottleneck is broadcast fan-out, not the language.
Naive design — "emit one `tile:update` to every client on every claim" — is **O(U²) messages/sec** (U users each claiming, each claim fanned to U clients). That, not Node, is what melts at scale. The fix:

**Tick-based batched delta broadcasting (the core real-time technique):**
- The server buffers tile changes and flushes a single **coalesced `tiles:update` (array)** on a fixed tick (~60ms ≈ 15–20 fps). Multiple claims to the same tile within a tick collapse to the latest `seq`.
- Each client therefore receives **≤~20 messages/sec regardless of how many users are active** → fan-out becomes **O(U) linear**, not quadratic.
- Clients apply each batch in **one store update inside `requestAnimationFrame`**, so 100 simultaneous claims = **1 React render**, not 100. The UI stays smooth during bursts.

**Cooldown is also a natural rate governor:** 1.5s cooldown caps each user at ≤0.67 claims/sec, bounding total write rate to ≈`0.67 × U` claims/sec. No single user can flood the system, and aggregate load is predictable.

**Redis is the single serialization point:** every claim is one atomic Lua call; Redis sustains 100k+ ops/sec — orders of magnitude above our bound. Because app instances hold no authoritative state, Redis (not the app) is the consistency anchor.

### Horizontal scale-out — designed-in, toggled by config (not built by default)
The default build runs **one Node instance** (handles thousands of users with the batching above). To scale further:
- Run **N Node instances** behind a load balancer with **sticky sessions** (WebSocket affinity).
- Each instance `SUBSCRIBE`s to a Redis pub/sub channel of tile changes, accumulates into its own per-tick buffer, and flushes batches to *its own* connected clients (no cross-instance double-send).
- Redis remains the authoritative store + serializer; the **atomic Lua guarantees correctness no matter which instance handled the claim**. Scaling is a Compose `--scale` flag + LB, not a rewrite.

### Alternatives considered (and why Node+Socket.IO+Redis wins here)
| Option | Verdict |
|---|---|
| raw `ws` / uWebSockets.js | Max throughput, fewer conveniences. Kept as a drop-in engine option; not needed for the target. |
| Elixir/Phoenix Channels | Built for millions, but adds a second language/runtime and is slower to build cleanly for this scope. |
| Managed (Ably/Pusher/Supabase/Cloudflare DO) | Would offload scaling, but the brief explicitly wants to see *our* backend + real-time thinking. We build it. |

**Conclusion:** Node + Socket.IO + Redis is the cleanest stack that demonstrably scales to the realistic target now, with a documented, low-effort path well beyond it.

---

## Tech Stack & Rationale

| Layer | Choice | Why |
|---|---|---|
| Frontend | **Next.js 15 (App Router) + React + TypeScript** | Required; single client board route. |
| Styling | **Tailwind CSS v4** + CSS custom properties | Fast, consistent dark/pastel design tokens. |
| Client state | **Zustand** | Per-tile selector subscriptions → a tile update re-renders one tile, not 1024. |
| Animation | **Framer Motion** (chrome) + **CSS keyframes** (tiles) | Motion for panels/toasts/leaderboard reorder; CSS for cheap compositor-only tile pulses. |
| Zoom/pan | **react-zoom-pan-pinch** | One transform on the grid container (bonus). |
| Realtime | **Socket.IO** (client+server), WS-only transport | Rooms, acks, auto-reconnect; Redis-adapter-ready for scale-out. |
| Backend | **Node + TS + Express** (thin `/health` shell) + **Socket.IO server** | I/O-bound fan-out is Node's sweet spot; Express is off the hot path. |
| State + durability | **Redis** (single, **AOF**) via **ioredis** | One component: state + cooldown TTL + leaderboard (sorted set) + atomic Lua + durability + pub/sub. App instances stay stateless. |
| Monorepo | **pnpm workspaces**, 3 packages | Shared typed contract between client/server prevents drift. |
| Infra | **Docker + Compose** (base + dev override + prod) | One command to run/test; clean prod images; `--scale server=N` ready. |

---

## Repository Structure

```
Inboxkit/
├─ package.json / pnpm-workspace.yaml   # workspace root, dev scripts (concurrently)
├─ docker-compose.yml                   # base: web, server, redis
├─ docker-compose.override.yml          # dev: bind mounts, hot reload
├─ docker-compose.prod.yml              # prod: multi-stage, healthchecks, restart policies
├─ .env.example / README.md             # design writeup + run instructions
├─ packages/shared/src/
│  ├─ contract.ts        # socket event maps (ClientToServer / ServerToClient)
│  ├─ types.ts           # Tile, User, ClaimResult, Snapshot, LeaderboardEntry
│  └─ constants.ts       # GRID_COLS/ROWS, COOLDOWN_MS, TICK_MS, PALETTE
├─ apps/server/src/
│  ├─ index.ts           # Express + Socket.IO bootstrap, /health
│  ├─ redis.ts           # ioredis client(s) + script loading + pub/sub channel
│  ├─ claim.lua          # ATOMIC claim (correctness core)
│  ├─ gameService.ts     # join/claim/snapshot/leaderboard (wraps Redis)
│  ├─ broadcaster.ts     # per-tick buffer → coalesced batched `tiles:update`
│  ├─ socket.ts          # connection handlers, presence, abuse guard
│  └─ config.ts          # env (PORT, REDIS_URL, CORS origin)
├─ apps/server/test/claim.test.ts       # vitest: claim-engine edge cases
├─ apps/server/loadtest.ts              # spawn N socket clients firing claims
└─ apps/web/src/
   ├─ app/{layout,page}.tsx + globals.css   # design tokens, grain, vignette
   ├─ lib/socket.ts                          # typed Socket.IO client singleton
   ├─ store/gridStore.ts                     # tiles map, optimistic + seq + batch apply
   ├─ store/sessionStore.ts                  # identity (localStorage), online, leaderboard
   ├─ hooks/useGameSocket.ts                 # wires socket events <-> stores (rAF batch)
   └─ components/
      ├─ join/JoinScreen.tsx
      ├─ board/{Board,Tile}.tsx              # zoom/pan grid; memo'd single-selector tile
      ├─ hud/{TopBar,Leaderboard,ActivityFeed,CooldownIndicator}.tsx
      └─ ui/{Toast,ColorSwatch,GlowButton}.tsx
```

---

## Shared Contract (`packages/shared`)

```ts
// constants.ts
export const GRID_COLS = 32, GRID_ROWS = 32;     // 1024 tiles ("hundreds"); configurable up to a few thousand
export const COOLDOWN_MS = 1500;                  // per-user rate limit between captures
export const LOCK_MS = 2500;                      // fresh captures are shielded this long (0 = pure overwrite)
export const TICK_MS = 60;                        // broadcast batch flush interval
export const PALETTE = [ /* ~12 curated PASTEL hues, harmonious on a dark backdrop */ ] as const;

// types.ts
export type TileId = number;                       // 0..N-1, row-major
export interface ClaimedTile { id: TileId; owner: string; color: string; seq: number; }
export interface User { id: string; name: string; color: string; }
export interface LeaderboardEntry { userId: string; name: string; color: string; tiles: number; largestCluster: number; }
export interface Snapshot {
  config: { cols: number; rows: number; cooldownMs: number };
  tiles: ClaimedTile[];                            // claimed only; unclaimed = default
  online: number; leaderboard: LeaderboardEntry[]; seq: number;
}
export type ClaimResult =
  | { ok: true; tile: ClaimedTile }
  | { ok: false; reason: 'cooldown'; cooldownRemainingMs: number }
  | { ok: false; reason: 'locked'; lockRemainingMs: number };   // tile freshly shielded by another user

// contract.ts
export interface ClientToServer {
  join: (p: { userId?: string; name: string; color: string },
         ack: (r: { userId: string; snapshot: Snapshot }) => void) => void;
  claim: (p: { tileId: TileId }, ack: (r: ClaimResult) => void) => void;
}
export interface ServerToClient {
  'tiles:update': (batch: ClaimedTile[]) => void;        // BATCHED delta (coalesced per tick)
  'leaderboard:update': (l: LeaderboardEntry[]) => void;
  'presence:update': (p: { online: number }) => void;
}
```

---

## Backend Design (`apps/server`)

### Redis data model
- `grid` — **hash** `tileId → JSON{owner,color,seq}` (claimed tiles only).
- `seq` — **counter** (`INCR`): global monotonic version; every claim gets a fresh `seq`.
- `cd:<userId>` — **string + PX TTL**: presence = on cooldown; `PTTL` = remaining ms.
- `lock:<tileId>` — **string + PX TTL** (`LOCK_MS`): a freshly captured tile is shielded; others can't overwrite until it expires.
- `lb` — **sorted set** `userId → tiles owned`.
- `users` — **hash** `userId → JSON{name,color}` → resolves leaderboard display.
- pub/sub channel `tile-changes` — carries deltas so every instance can batch for its own clients.

### Atomic claim (`claim.lua`) — the correctness core
One atomic script (Redis single-threaded → no interleaving):
```
KEYS = grid, lb, cd:<user>, seq, lock:<tile>   ARGV = tileId, userId, color, cooldownMs, lockMs
1. cdttl = PTTL cd:<user>;  if cdttl > 0 -> return {0,'cooldown',cdttl}    -- rate limit, checked FIRST
2. prev = HGET grid tileId;  prevOwner = prev and decode(prev).owner
3. lkttl = PTTL lock:<tile>; if lkttl > 0 and prevOwner ~= userId -> return {0,'locked',lkttl}  -- shielded
4. s = INCR seq
5. HSET grid tileId encode{owner=userId, color=color, seq=s}
6. if prevOwner ~= userId then                                 -- only on ownership TRANSFER
     if prevOwner then ns = ZINCRBY lb -1 prevOwner; if ns<=0 then ZREM lb prevOwner end end
     ZINCRBY lb 1 userId
   end                                                          -- self-overwrite: no score change
7. SET cd:<user> 1 PX cooldownMs;  if lockMs > 0 then SET lock:<tile> 1 PX lockMs end
8. return {1, s}
```
Covers every flagged edge case: cooldown-checked-before-mutate with precise `PTTL`, no decrement on unclaimed tiles, no double-count on self-overwrite, zero-score cleanup. `seq` (not wall-clock) is the version → clock-skew immune.

### Socket flows
- **`join {userId?,name,color}`**: mint `userId` if absent (`nanoid`); `HSET users`; build **compact snapshot** (`HGETALL grid`, top-N `lb`, current `seq`, online); ack `{userId, snapshot}`. `INCR online`; schedule `presence:update`.
- **`claim {tileId}`**: run `claim.lua`. Reject → ack `{ok:false, reason:'cooldown'|'locked', …RemainingMs}`. Success → ack `{ok:true, tile}` and **PUBLISH the delta to `tile-changes`** (do NOT emit immediately).
- **Broadcaster (`broadcaster.ts`)**: every instance subscribes to `tile-changes`, accumulates deltas into a per-tick buffer (coalesced by tileId, keep highest `seq`); on each `TICK_MS` flush, emits one **`tiles:update` batch** to its local clients. Leaderboard (incl. each user's **largest contiguous cluster** via a cheap flood-fill over the grid — the *area-control* stat) is recomputed + broadcast on a slower cadence (~500ms–1s) only when changed.
- **disconnect**: `DECR online`; debounced `presence:update`. Identity persists in Redis `users`, so refresh/rejoin keeps the same `userId`.
- **`/health`** (Express): pings Redis → Docker healthcheck.
- **Abuse guard**: ignore `claim` events arriving faster than ~200ms from one socket; Lua still authoritatively rejects via cooldown.

---

## Frontend Design (`apps/web`)

### State + reconciliation (`gridStore.ts`)
- Normalized `tiles: Map<TileId, ClaimedTile>`. `<Tile>` reads only its own entry via a Zustand selector → single-tile re-renders.
- **Optimistic claim:** on click, save current value, paint with my color (`pending` pulse), emit `claim`.
  - ack `ok:true` → confirm; ack `ok:false` → **roll back to saved value** + start client cooldown UI from `cooldownRemainingMs`.
- **Batched apply:** `tiles:update` arrives as an array; apply the whole batch in **one store update inside `requestAnimationFrame`**. Per-tile guard: accept a tile only if `incoming.seq > current.seq` → concurrent overwrites converge to last writer.
- **Reconnect:** drop all pending optimistic state, replace the entire grid from a fresh snapshot.
- Cooldown timer runs client-side for instant UI; server `cooldownRemainingMs` is authoritative on reject (clock-skew safe).

### Rendering (smooth at 1000+ tiles, under bursts)
- **DOM CSS Grid** (not canvas): native cheap glows/shadows/ripples; the win is re-rendering only the changed tile (per-tile selectors + `React.memo`).
- **Animate compositor-only props** — glow on a pseudo-element/overlay, animate `opacity`/`transform: scale()` (never shadow-blur radius) → mass-update bursts stay on the GPU thread.
- `content-visibility: auto; contain: layout paint` on tiles → off-screen (zoomed) tiles skip paint.
- Zoom/pan = one transform on the grid **container**.

### Visual design language — sleek dark + cohesive pastels
- **Backdrop:** deep dark (`#08080a`/`#0b0b0f`) with a subtle **pastel-tinted radial glow** and a faint SVG film-grain overlay (~3%).
- **Surfaces:** glassy `rgba(20,20,24,.7)` + `backdrop-blur`, hairline `rgba(255,255,255,.08)`, layered depth shadow (`inset 0 1px 0 rgba(255,255,255,.04)`, `0 20px 60px -20px rgba(0,0,0,.8)`).
- **One accent system:** a single soft pastel accent (e.g., periwinkle/mint) used consistently for primary actions, the live online indicator, and focus glows — restrained so it reads premium, not loud.
- **Tiles:** owner colors drawn from a **curated pastel palette** (desaturated, mutually harmonious) so the board never clashes; claimed tiles carry a soft color glow. Unclaimed = faint fill + hairline, hover → `scale(1.08)` lift + soft glow. Just-claimed = **ripple burst + scale pop**.
- **Cooldown/lock UX:** depleting cooldown pill/ring; freshly captured tiles show a brief **shield shimmer** while locked; rejected clicks (cooldown *or* locked) → `not-allowed` cursor + subtle shake + a toast explaining why.
- **Join screen:** centered glass card, name input with focus glow, **pastel swatch row** (selected = ring + glow), glowing "Enter the board" CTA; animated entrance, crossfade into board.
- **HUD:** top bar (wordmark, pulsing live **online count**, identity chip + your tile count); right panel = **leaderboard** (Framer Motion rank reordering, count-up numbers, your row highlighted) + **live activity feed** (derived client-side from `tiles:update`, fade-in rows).
- **Motion split:** Framer Motion for chrome; CSS keyframes for tile hover/glow/pulse.
- **Cohesion rules:** shared radii, shared glow language, one accent, consistent spacing — everything flows together.

---

## Docker / Infra

- **`docker-compose.yml` (base):** `web`, `server`, `redis` (AOF on, named volume); `depends_on` with `condition: service_healthy`.
- **`docker-compose.override.yml` (dev):** bind-mount source; `next dev` + `tsx watch`; no build step.
- **`docker-compose.prod.yml`:** multi-stage Dockerfiles (deps→build→slim), Next `output: 'standalone'`, compiled server (`tsc`→`node dist`), healthchecks, restart policies. `docker compose up --scale server=N` ready (add LB with sticky sessions for true multi-node).
- **Env split (gotcha):** browser connects via public `NEXT_PUBLIC_SOCKET_URL` (e.g. `http://localhost:4000`), distinct from server→redis internal `REDIS_URL` (`redis://redis:6379`). Socket.IO `cors.origin` = web origin.
- **One command:** `docker compose up --build` → web `:3000`, server `:4000`, redis `:6379`.

---

## Build Order (de-risk the spine first)
1. **Contract** — `packages/shared` (types, events, constants). Everything keys off this.
2. **Claim engine** — Redis + `claim.lua` + `gameService`; **vitest** the edge cases *before any UI*.
3. **Socket + broadcaster** — join/claim/snapshot + tick-batched `tiles:update` + leaderboard + `/health`; prove two tabs see each other.
4. **Grid rendering** — store + per-tile selectors + batched rAF apply (unstyled); confirm only changed tiles re-render.
5. **Premium UI pass** — dark+pastel theme, glows, ripple, hover, cooldown feedback, toasts.
6. **Bonuses (value order):** join polish → leaderboard → zoom/pan → activity feed → presence count → micro-interactions.
7. **Docker** (base → dev → prod), then **loadtest** + README writeup.

---

## Verification (end-to-end)
- `docker compose up --build`; open **2+ tabs**, join with different names/colors.
- **Realtime:** click in tab A → appears in B/C within a tick.
- **Cooldown:** rapid clicks → rejected with a live countdown.
- **Conflict:** two tabs click the same tile near-simultaneously → both converge to the last writer (`seq`); leaderboard stays consistent (no drift / negatives).
- **Self-overwrite:** re-click your own tile → no leaderboard double-count.
- **Persistence:** `docker compose restart` and full `down`→`up` (keeping the volume) → board retained (AOF); clients reconnect and resync with no drift.
- **Identity:** refresh → same `userId` (localStorage); leaderboard doesn't fragment.
- **Load/concurrency (the headline test):** `pnpm --filter server loadtest` spawns **200–500 socket clients** each claiming on cooldown. Assert: server stays responsive, all clients converge to the same board, and the **per-client message rate stays bounded (~one batch/tick)** — proving the O(U) broadcast design holds. Watch React DevTools: **1 render per batch**, no jank.
- **Engine tests:** `pnpm --filter server test` (vitest) green.

---

## Out of Scope / Stretch
- **Out:** accounts/auth (name+color join only), free custom colors (curated pastel palette).
- **Designed-in but not operated by default:** multi-node horizontal scale-out (single instance ships; `--scale` + LB documented).
- **Stretch (only if time):** live presence cursors, minimap, sound/haptic micro-feedback, deploy (server → Railway/Render, web → Vercel).
