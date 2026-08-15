import type { Server as HttpServer } from 'node:http';
import type { IncomingMessage } from 'node:http';
import WebSocket, { WebSocketServer } from 'ws';
import { z } from 'zod';
import type { AuthSessionProvider } from '../../types/auth.js';
import type { PhishingEvents } from './phishing.events.js';
import type { PhishingRepository } from './phishing.repository.js';
import { publicPhishingSession, type PhishingService } from './phishing.service.js';
import { createPhishingAnswerSchema, phishingSessionIdSchema } from './phishing.validation.js';

const socketMessageSchema = createPhishingAnswerSchema.extend({
  type: z.literal('answer'),
  requestId: z.string().trim().min(1).max(128),
}).strict();

interface SocketContext {
  readonly userId: string;
  readonly publicId: string;
  readonly headers: Headers;
  lastAuthCheck: number;
}

function requestHeaders(request: IncomingMessage): Headers {
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (typeof value === 'string') headers.set(name, value);
    else if (value) for (const item of value) headers.append(name, item);
  }
  return headers;
}

function reject(request: IncomingMessage, status: number, message: string): void {
  request.socket.write(`HTTP/1.1 ${status} ${message}\r\nConnection: close\r\n\r\n`);
  request.socket.destroy();
}

function send(socket: WebSocket, message: unknown): void {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}

export function attachPhishingWebSocket(input: {
  readonly server: HttpServer;
  readonly auth: AuthSessionProvider;
  readonly frontendOrigins: readonly string[];
  readonly repository: PhishingRepository;
  readonly service: PhishingService;
  readonly events: PhishingEvents;
  readonly now: () => Date;
}) {
  const websocketServer = new WebSocketServer({ noServer: true, maxPayload: 2048, perMessageDeflate: false });
  const contexts = new WeakMap<WebSocket, SocketContext>();
  const alive = new WeakMap<WebSocket, boolean>();
  const pendingCommands = new WeakMap<WebSocket, number>();
  const commandTimes = new WeakMap<WebSocket, number[]>();
  const queues = new Map<string, Promise<void>>();

  websocketServer.on('connection', (socket) => {
    const context = contexts.get(socket);
    if (!context) {
      socket.close(1011, 'Missing socket context');
      return;
    }
    alive.set(socket, true);
    pendingCommands.set(socket, 0);
    socket.on('pong', () => alive.set(socket, true));
    socket.on('error', () => socket.terminate());
    socket.on('message', (rawMessage) => {
      let message: unknown;
      try {
        message = JSON.parse(Buffer.from(rawMessage as ArrayBuffer).toString('utf8')) as unknown;
      } catch {
        send(socket, { type: 'answer_error', message: 'Invalid WebSocket message.' });
        return;
      }
      const parsed = socketMessageSchema.safeParse(message);
      if (!parsed.success) {
        send(socket, { type: 'answer_error', message: 'Invalid WebSocket message.' });
        return;
      }
      const cutoff = Date.now() - 10_000;
      const recent = (commandTimes.get(socket) ?? []).filter((time) => time >= cutoff);
      if (recent.length >= 10) {
        send(socket, { type: 'answer_error', requestId: parsed.data.requestId, message: 'Terlalu banyak permintaan.' });
        return;
      }
      recent.push(Date.now());
      commandTimes.set(socket, recent);
      const queued = pendingCommands.get(socket) ?? 0;
      if (queued >= 3) {
        send(socket, { type: 'answer_error', requestId: parsed.data.requestId, message: 'Terlalu banyak jawaban menunggu.' });
        return;
      }
      pendingCommands.set(socket, queued + 1);
      const { requestId, questionId, selectedClueIds, markedSuspicious } = parsed.data;
      const previous = queues.get(context.publicId) ?? Promise.resolve();
      const next = previous.then(async () => {
        if (Date.now() - context.lastAuthCheck >= 60_000) {
          const authSession = await input.auth.api.getSession({ headers: context.headers });
          if (!authSession || authSession.user.id !== context.userId) {
            socket.close(1008, 'Authentication expired');
            return;
          }
          context.lastAuthCheck = Date.now();
        }
        const result = await input.service.answer(
          context.userId,
          context.publicId,
          requestId,
          { questionId, selectedClueIds, markedSuspicious },
          input.now(),
        );
        send(socket, { type: 'answer_result', requestId, data: result });
      }).catch(() => {
        send(socket, { type: 'answer_error', requestId, message: 'Jawaban belum dapat disimpan.' });
      }).finally(() => {
        pendingCommands.set(socket, Math.max(0, (pendingCommands.get(socket) ?? 1) - 1));
        if (queues.get(context.publicId) === next) queues.delete(context.publicId);
      });
      queues.set(context.publicId, next);
    });
    void input.repository.findSessionByPublicId(context.publicId, context.userId).then((session) => {
      if (session) send(socket, { type: 'phishing.snapshot', data: publicPhishingSession(session) });
    }).catch(() => socket.close(1011, 'Snapshot unavailable'));
  });

  const unsubscribe = input.events.subscribe((event) => {
    const message = JSON.stringify(event.payload);
    for (const socket of websocketServer.clients) {
      const context = contexts.get(socket);
      if (socket.readyState === WebSocket.OPEN && context?.userId === event.userId && context.publicId === event.publicId) {
        socket.send(message);
      }
    }
  });

  const heartbeat = setInterval(() => {
    for (const socket of websocketServer.clients) {
      if (alive.get(socket) === false) {
        socket.terminate();
        continue;
      }
      alive.set(socket, false);
      socket.ping();
    }
  }, 30_000);
  heartbeat.unref();

  input.server.on('upgrade', (request, _socket, head) => {
    void (async () => {
      const url = new URL(request.url ?? '/', 'http://localhost');
      const match = /^\/api\/v1\/ws\/phishing-sessions\/([^/]+)$/u.exec(url.pathname);
      if (!match) return;
      if (!input.frontendOrigins.includes(request.headers.origin ?? '')) {
        reject(request, 403, 'Forbidden');
        return;
      }
      const publicId = phishingSessionIdSchema.safeParse(match[1]);
      if (!publicId.success) {
        reject(request, 400, 'Bad Request');
        return;
      }
      const headers = requestHeaders(request);
      const authSession = await input.auth.api.getSession({ headers });
      if (!authSession) {
        reject(request, 401, 'Unauthorized');
        return;
      }
      const session = await input.repository.findSessionByPublicId(publicId.data, authSession.user.id);
      if (!session) {
        reject(request, 404, 'Not Found');
        return;
      }
      websocketServer.handleUpgrade(request, request.socket, head, (socket) => {
        contexts.set(socket, { userId: authSession.user.id, publicId: publicId.data, headers, lastAuthCheck: Date.now() });
        websocketServer.emit('connection', socket, request);
      });
    })().catch(() => reject(request, 500, 'Internal Server Error'));
  });

  return {
    close(): void {
      clearInterval(heartbeat);
      unsubscribe();
      for (const socket of websocketServer.clients) socket.close(1001, 'Server shutting down');
      websocketServer.close();
    },
  };
}
