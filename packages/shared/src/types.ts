/** Domain types shared by client + server. */

/** Row-major index into the board, 0 .. TILE_COUNT-1. */
export type TileId = number;

/** A claimed tile. `seq` is a server-issued monotonic version (last-writer-wins). */
export interface ClaimedTile {
  id: TileId;
  owner: string; // userId
  color: string; // palette id
  seq: number;
}

export interface User {
  id: string;
  name: string;
  color: string; // palette id
}

export interface LeaderboardEntry {
  userId: string;
  name: string;
  color: string; // palette id
  tiles: number; // total tiles currently owned
  largestCluster: number; // biggest contiguous block (area-control stat)
}

/** Sent once on join, and again on every reconnect to fully resync. */
/** A special tile players race to grab for a bonus effect. */
export type PowerUpType = 'bomb' | 'burst' | 'shield';
export interface PowerUp {
  tileId: TileId;
  type: PowerUpType;
}

/** Live match state — the round currently in progress. */
export interface RoundState {
  id: number;
  remainingMs: number;
  durationMs: number;
}

/** Broadcast when a round ends, just before the board resets. */
export interface RoundResult {
  winner: { userId: string; name: string; color: string; tiles: number } | null;
  leaderboard: LeaderboardEntry[];
  wins: number; // the winner's total round wins
}

/** Another player's live cursor position, in board space (0..1). */
export interface CursorInfo {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
}

export interface Snapshot {
  config: {
    cols: number;
    rows: number;
    cooldownMs: number;
    lockMs: number;
  };
  tiles: ClaimedTile[]; // claimed tiles only — unclaimed is the implicit default
  online: number;
  leaderboard: LeaderboardEntry[];
  seq: number; // current global sequence at snapshot time
  round: RoundState;
  powerups: PowerUp[];
}

/** Result of a claim attempt, returned via the socket ack. */
export type ClaimResult =
  | { ok: true; tile: ClaimedTile; power?: PowerUpType }
  | { ok: false; reason: 'cooldown'; remainingMs: number }
  | { ok: false; reason: 'locked'; remainingMs: number }
  | { ok: false; reason: 'invalid' };

export type JoinResult = { userId: string; snapshot: Snapshot };
