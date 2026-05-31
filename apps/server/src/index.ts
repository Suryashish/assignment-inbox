import { createServer } from 'node:http';
import express from 'express';
import { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@ctb/shared';
import { config } from './config';
import { pingRedis, closeRedis } from './redis';
import { registerSocketHandlers } from './socket';
import { startBroadcaster } from './broadcaster';
import type { SocketData } from './ioTypes';

const app = express();

app.get('/health', async (_req, res) => {
  const redisOk = await pingRedis();
  res.status(redisOk ? 200 : 503).json({ status: redisOk ? 'ok' : 'degraded', redis: redisOk });
});

const httpServer = createServer(app);

const io = new Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(
  httpServer,
  {
    cors: { origin: config.corsOrigin, methods: ['GET', 'POST'] },
    transports: ['websocket', 'polling'],
  },
);

registerSocketHandlers(io);
const stopBroadcaster = startBroadcaster(io);

httpServer.listen(config.port, () => {
  console.log(`[ctb] server listening on :${config.port} (redis: ${config.redisUrl})`);
});

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[ctb] ${signal} received, shutting down…`);
  stopBroadcaster();
  await new Promise<void>((resolve) => io.close(() => resolve()));
  await closeRedis();
  process.exit(0);
}
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
