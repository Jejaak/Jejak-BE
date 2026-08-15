import type { IncomingMessage, Server as HttpServer } from 'node:http';
import type { Duplex } from 'node:stream';
import { fromNodeHeaders } from 'better-auth/node';
import { WebSocket, WebSocketServer, type RawData } from 'ws';
import { z } from 'zod';
import type { AuthSessionProvider } from '../../types/auth.js';
import type { PrivacySessionService } from './privacy-session.service.js';
import { privacyPublicIdSchema } from './privacy-session.validation.js';

const privacySocketMessageSchema = z.object({
  type: z.literal('answer'),
  requestId: z.string().min(1).max(64),
  questionId: z.string().min(1).max(64),
  choice: z.enum(['SHARE', 'REJECT']),
}).strict();

interface LiveSocket extends WebSocket {
  isAlive: boolean;
}

function rejectUpgrade(socket: Duplex, status: 400 | 401 | 403 | 404 | 500, message: string): void {
  socket.write(`HTTP/1.1 ${status} ${message}\r\nConnection: close\r\n\r\n`);
  socket.destroy();
}

function messageText(message: RawData): string {
  if (Buffer.isBuffer(message)) return message.toString('utf8');
  if (message instanceof ArrayBuffer) return Buffer.from(message).toString('utf8');
  if (Array.isArray(message)) return Buffer.concat(message).toString('utf8');
  return Buffer.from(message).toString('utf8');
}

export function attachPrivacySessionGateway(input: {
  server: HttpServer;
  auth: AuthSessionProvider;
  service: PrivacySessionService;
  frontendOrigins: readonly string[];
  now: () => Date;
}): () => void {
  const websocketServer = new WebSocketServer({
    noServer: true,
    maxPayload: 2048,
    perMessageDeflate: false,
  });
  const clients = new Map<string, Set<LiveSocket>>();
  const queues = new Map<string, Promise<void>>();

  function send(socket: WebSocket, message: unknown): void {
    if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
  }

  function broadcast(publicId: string, message: unknown): void {
    for (const socket of clients.get(publicId) ?? []) send(socket, message);
  }

  function closeSession(publicId: string): void {
    for (const socket of clients.get(publicId) ?? []) socket.close(1000, 'Session ended');
  }

  const unsubscribeTerminal = input.service.subscribeTerminal(closeSession);

  const handleUpgrade = (request: IncomingMessage, socket: Duplex, head: Buffer): void => {
    void (async () => {
      const url = new URL(request.url ?? '/', 'http://localhost');
      if (!/^\/api\/v1\/ws\/privacy-sessions(?:\/|$)/u.test(url.pathname)) return;
      const match = /^\/api\/v1\/ws\/privacy-sessions\/(PRV-[A-F0-9]{6}-[A-F0-9]{6}-[A-F0-9]{4})$/u.exec(url.pathname);
      if (!match || url.search !== '') return rejectUpgrade(socket, 400, 'Bad Request');
      if (!input.frontendOrigins.includes(request.headers.origin ?? '')) return rejectUpgrade(socket, 403, 'Forbidden');
      if (!request.headers.cookie) return rejectUpgrade(socket, 401, 'Unauthorized');
      const publicId = privacyPublicIdSchema.parse(match[1]);
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
        send(liveSocket, { type: 'privacy.session', data: session });

        liveSocket.on('pong', () => {
          liveSocket.isAlive = true;
        });
        liveSocket.on('error', () => liveSocket.terminate());
        liveSocket.on('close', () => {
          sessionClients.delete(liveSocket);
          if (sessionClients.size === 0) clients.delete(publicId);
        });
        liveSocket.on('message', (rawMessage) => {
          let message: unknown;
          try {
            message = JSON.parse(messageText(rawMessage)) as unknown;
          } catch {
            send(liveSocket, { type: 'privacy.error', message: 'Pesan WebSocket tidak valid.' });
            return;
          }
          const parsed = privacySocketMessageSchema.safeParse(message);
          if (!parsed.success) {
            send(liveSocket, { type: 'privacy.error', message: 'Pesan WebSocket tidak valid.' });
            return;
          }

          const previous = queues.get(publicId) ?? Promise.resolve();
          const next = previous.then(async () => {
            const result = await input.service.answer(
              authSession.user.id,
              session.id,
              `privacy-ws:${parsed.data.requestId}`,
              {
                questionId: parsed.data.questionId,
                choice: parsed.data.choice,
              },
              input.now(),
            );
            broadcast(publicId, {
              type: 'privacy.answer.result',
              requestId: parsed.data.requestId,
              data: result,
            });
            if (result.session.status !== 'ACTIVE') closeSession(publicId);
          }).catch(() => {
            send(liveSocket, {
              type: 'privacy.answer.error',
              requestId: parsed.data.requestId,
              message: 'Jawaban belum dapat disimpan.',
            });
          }).finally(() => {
            if (queues.get(publicId) === next) queues.delete(publicId);
          });
          queues.set(publicId, next);
        });
      });
    })().catch(() => rejectUpgrade(socket, 500, 'Internal Server Error'));
  };

  input.server.on('upgrade', handleUpgrade);

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
  heartbeat.unref();

  return () => {
    input.server.off('upgrade', handleUpgrade);
    unsubscribeTerminal();
    clearInterval(heartbeat);
    queues.clear();
    for (const socket of websocketServer.clients) socket.close(1001, 'Server shutting down');
    websocketServer.close();
  };
}
