/**
 * The Socket.IO event contract. Both ends import these maps and pass them as
 * Socket.IO generics, so a typo or a shape change is a compile error, not a
 * runtime surprise.
 */
import type {
  ClaimResult,
  JoinResult,
  LeaderboardEntry,
  ClaimedTile,
  TileId,
} from './types';

export interface ClientToServerEvents {
  join: (
    payload: { userId?: string; name: string; color: string },
    ack: (result: JoinResult) => void,
  ) => void;
  claim: (payload: { tileId: TileId }, ack: (result: ClaimResult) => void) => void;
}

export interface ServerToClientEvents {
  /** Coalesced delta — one array per server tick, not one message per claim. */
  'tiles:update': (batch: ClaimedTile[]) => void;
  'leaderboard:update': (leaderboard: LeaderboardEntry[]) => void;
  'presence:update': (payload: { online: number }) => void;
}

/** Socket.IO event name literals, handy to avoid stringly-typed mistakes. */
export const EVENTS = {
  join: 'join',
  claim: 'claim',
  tilesUpdate: 'tiles:update',
  leaderboardUpdate: 'leaderboard:update',
  presenceUpdate: 'presence:update',
} as const;
