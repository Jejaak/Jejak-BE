import type { Server as HttpServer } from 'node:http';
import type { Duplex } from 'node:stream';
import { fromNodeHeaders } from 'better-auth/node';
import { WebSocket, WebSocketServer } from 'ws';
import { z } from 'zod';
import type { AuthSessionProvider } from '../../types/auth.js';
import type { VirusSessionService } from './virus-session.service.js';
import { virusActionSchema, virusPublicIdSchema } from './virus-session.validation.js';

const socketMessageSchema = z.discriminatedUnion('type', [
  virusActionSchema.extend({
    type: z.literal('action'),
    requestId: z.string().min(1).max(64),
  }).strict(),
  z.object({ type: z.literal('abandon') }).strict(),
]);

interface LiveSocket extends WebSocket {
  isAlive: boolean;
}

function rejectUpgrade(socket: Duplex, status: number, message: string): void {
  socket.write(`HTTP/1.1 ${status} ${message}\r\nConnection: close\r\n\r\n`);
  socket.destroy();
}

export function attachVirusSessionGateway(input: {
  server: HttpServer;
  auth: AuthSessionProvider;
  service: VirusSessionService;
  frontendOrigins: readonly string[];
  now: () => Date;
}): () => void {
  const websocketServer = new WebSocketServer({ noServer: true });
  const clients = new Map<string, Set<LiveSocket>>();
  const queues = new Map<string, Promise<void>>();

  function send(socket: WebSocket, message: unknown): void {
    if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
  }

  function broadcast(publicId: string, message: unknown): void {
    for (const socket of clients.get(publicId) ?? []) send(socket, message);
  }

  input.server.on('upgrade', (request, socket, head) => {
    void (async () => {
      const url = new URL(request.url ?? '/', 'http://localhost');
      const match = /^\/api\/v1\/ws\/virus-sessions\/(VRS-[A-F0-9]{6}-[A-F0-9]{6}-[A-F0-9]{4})$/u.exec(url.pathname);
      if (!match) return;
      if (!input.frontendOrigins.includes(request.headers.origin ?? '')) return rejectUpgrade(socket, 403, 'Forbidden');
      const publicId = virusPublicIdSchema.parse(match[1]);
      const authSession = await input.auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
      if (!authSession) return rejectUpgrade(socket, 401, 'Unauthorized');
      const session = await input.service.getActive(authSession.user.id, publicId);
      if (!session) return rejectUpgrade(socket, 404, 'Not Found');

      websocketServer.handleUpgrade(request, socket, head, (rawSocket) => {
        const liveSocket = rawSocket as LiveSocket;
        liveSocket.isAlive = true;
        const sessionClients = clients.get(publicId) ?? new Set<LiveSocket>();
        sessionClients.add(liveSocket);
        clients.set(publicId, sessionClients);
        send(liveSocket, { type: 'session', data: session });

        liveSocket.on('pong', () => {
          liveSocket.isAlive = true;
        });
        liveSocket.on('close', () => {
          sessionClients.delete(liveSocket);
          if (sessionClients.size === 0) clients.delete(publicId);
        });
        liveSocket.on('message', (rawMessage) => {
          const messageText = typeof rawMessage === 'string' ? rawMessage : Buffer.from(rawMessage as ArrayBuffer).toString('utf8');
          let message: unknown;
          try {
            message = JSON.parse(messageText) as unknown;
          } catch {
            send(liveSocket, { type: 'error', code: 'invalid_json', message: 'Invalid WebSocket message.' });
            return;
          }
          const parsed = socketMessageSchema.safeParse(message);
          if (!parsed.success) {
            send(liveSocket, { type: 'error', code: 'invalid_message', message: 'Invalid WebSocket message.' });
            return;
          }
          if (parsed.data.type === 'abandon') {
            void input.service.abandon(authSession.user.id, session.id, input.now()).then(() => {
              broadcast(publicId, { type: 'session_ended', status: 'ABANDONED' });
              for (const client of clients.get(publicId) ?? []) client.close(1000, 'Session abandoned');
            }).catch(() => {
              send(liveSocket, { type: 'error', code: 'abandon_failed', message: 'Session could not be closed.' });
            });
            return;
          }
          const { requestId, fileId, action } = parsed.data;
          const previous = queues.get(publicId) ?? Promise.resolve();
          const next = previous.then(async () => {
            const result = await input.service.act(
              authSession.user.id,
              session.id,
              fileId,
              action,
              input.now(),
            );
            if (!result) {
              send(liveSocket, { type: 'action_error', requestId, message: 'File is unavailable.' });
              return;
            }
            broadcast(publicId, { type: 'action_result', requestId, data: result });
            if (result.session.status !== 'ACTIVE') {
              for (const client of clients.get(publicId) ?? []) client.close(1000, 'Session ended');
            }
          }).catch(() => {
            send(liveSocket, { type: 'action_error', requestId, message: 'File action could not be saved.' });
          }).finally(() => {
            if (queues.get(publicId) === next) queues.delete(publicId);
          });
          queues.set(publicId, next);
        });
      });
    })().catch(() => rejectUpgrade(socket, 500, 'Internal Server Error'));
  });

  const heartbeat = setInterval(() => {
    for (const socket of websocketServer.clients as Set<LiveSocket>) {
      if (!socket.isAlive) {
        socket.terminate();
        continue;
      }
      socket.isAlive = false;
      socket.ping();
    }
  }, 30_000);

  return () => {
    clearInterval(heartbeat);
    for (const socket of websocketServer.clients) socket.close(1001, 'Server shutting down');
    websocketServer.close();
  };
}
