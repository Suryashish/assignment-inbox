import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@ctb/shared';

// Socket.IO client generics are <ListenEvents, EmitEvents>.
export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? 'http://localhost:4000';

let socket: AppSocket | null = null;

/** Lazily create one shared socket for the whole app. */
export function getSocket(): AppSocket {
  if (!socket) {
    socket = io(URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 400,
      reconnectionDelayMax: 4000,
    });
  }
  return socket;
}
