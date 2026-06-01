/**
 * The Socket.IO event contract. Both ends import these maps and pass them as
 * Socket.IO generics, so a typo or a shape change is a compile error, not a
 * runtime surprise.
 */
import type {
  ClaimResult,
  CursorInfo,
  JoinResult,
  LeaderboardEntry,
  ClaimedTile,
  PowerUp,
  RoundResult,
  RoundState,
  TileId,
} from './types';

export interface ClientToServerEvents {
  join: (
    payload: { userId?: string; name: string; color: string },
    ack: (result: JoinResult) => void,
  ) => void;
  claim: (payload: { tileId: TileId }, ack: (result: ClaimResult) => void) => void;
  /** Wipe the shared board for everyone — starts a fresh game. */
  reset: () => void;
  /** Throttled cursor position in board space (0..1). */
  cursor: (payload: { x: number; y: number }) => void;
}

export interface ServerToClientEvents {
  /** Coalesced delta — one array per server tick, not one message per claim. */
  'tiles:update': (batch: ClaimedTile[]) => void;
  'leaderboard:update': (leaderboard: LeaderboardEntry[]) => void;
  'presence:update': (payload: { online: number }) => void;
  /** The board was reset — clients clear to an empty grid. */
  'board:reset': () => void;
  /** Round countdown sync (sent on join + ~1/s). */
  'round:state': (round: RoundState) => void;
  /** A round ended — show the winner before the board resets. */
  'round:end': (result: RoundResult) => void;
  /** Coalesced cursor positions of active players (one array per tick). */
  'cursors:update': (cursors: CursorInfo[]) => void;
  'power:spawn': (powerup: PowerUp) => void;
  'power:despawn': (payload: { tileId: TileId }) => void;
}

/** Socket.IO event name literals, handy to avoid stringly-typed mistakes. */
export const EVENTS = {
  join: 'join',
  claim: 'claim',
  reset: 'reset',
  cursor: 'cursor',
  tilesUpdate: 'tiles:update',
  leaderboardUpdate: 'leaderboard:update',
  presenceUpdate: 'presence:update',
  boardReset: 'board:reset',
  roundState: 'round:state',
  roundEnd: 'round:end',
  cursorsUpdate: 'cursors:update',
  powerSpawn: 'power:spawn',
  powerDespawn: 'power:despawn',
} as const;
