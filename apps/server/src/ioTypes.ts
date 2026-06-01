import type { Server, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@ctb/shared';

/** Per-connection state we attach after `join`. */
export interface SocketData {
  userId?: string;
  name?: string;
  color?: string;
}

type NoInterServer = Record<string, never>;

export type IO = Server<ClientToServerEvents, ServerToClientEvents, NoInterServer, SocketData>;
export type IOSocket = Socket<ClientToServerEvents, ServerToClientEvents, NoInterServer, SocketData>;
