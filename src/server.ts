import { createServer } from 'node:http';
import { createApp } from './app.js';
import { createAuth } from './auth/auth.js';
import { createAuthHandler } from './auth/handler.js';
import { byteSize, parseEnv } from './config/env.js';
import { getPrisma } from './db/prisma.js';
import { PhishingEvents } from './modules/phishing/phishing.events.js';
import { PrismaPhishingRepository } from './modules/phishing/phishing.repository.js';
import { PhishingService } from './modules/phishing/phishing.service.js';
import { attachPhishingWebSocket } from './modules/phishing/phishing.websocket.js';
import { attachPrivacySessionGateway } from './modules/privacy-session/privacy-session.gateway.js';
import { PrismaPrivacySessionRepository } from './modules/privacy-session/privacy-session.repository.js';
import { PrivacySessionService } from './modules/privacy-session/privacy-session.service.js';
import { PrismaProgressRepository } from './modules/progress/progress.repository.js';
import { attachVirusSessionGateway } from './modules/virus-session/virus-session.gateway.js';
import { PrismaVirusSessionRepository } from './modules/virus-session/virus-session.repository.js';
import { VirusSessionService } from './modules/virus-session/virus-session.service.js';

const env = parseEnv(process.env);
const prisma = getPrisma(env);
const auth = createAuth(prisma, env);
const phishingEvents = new PhishingEvents();
const phishingRepository = new PrismaPhishingRepository(prisma);
const phishingService = new PhishingService(phishingRepository, phishingEvents);
const privacySessionRepository = new PrismaPrivacySessionRepository(prisma);
const privacySessionService = new PrivacySessionService(privacySessionRepository);
const virusSessionRepository = new PrismaVirusSessionRepository(prisma);
const virusSessionService = new VirusSessionService(virusSessionRepository);
const app = createApp({
  config: {
    frontendOrigin: env.FRONTEND_ORIGIN,
    trustProxyHops: env.TRUST_PROXY_HOPS,
    jsonBodyLimit: env.JSON_BODY_LIMIT,
    apiRateLimitMax: env.API_RATE_LIMIT_MAX,
    apiRateLimitWindowMs: env.API_RATE_LIMIT_WINDOW_MS,
    authRateLimitMax: env.AUTH_RATE_LIMIT_MAX,
    authRateLimitWindowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
  },
  auth,
  authHandler: createAuthHandler(auth, byteSize(env.JSON_BODY_LIMIT)),
  phishingEvents,
  phishingRepository,
  phishingService,
  privacySessionRepository,
  privacySessionService,
  progressRepository: new PrismaProgressRepository(prisma),
  virusSessionRepository,
});
const server = createServer(app);
const phishingWebSocket = attachPhishingWebSocket({
  server,
  auth,
  frontendOrigin: env.FRONTEND_ORIGIN,
  repository: phishingRepository,
  service: phishingService,
  events: phishingEvents,
  now: () => new Date(),
});
const closePrivacySessionGateway = attachPrivacySessionGateway({
  server,
  auth,
  service: privacySessionService,
  frontendOrigin: env.FRONTEND_ORIGIN,
  now: () => new Date(),
});
const closeVirusSessionGateway = attachVirusSessionGateway({
  server,
  auth,
  service: virusSessionService,
  frontendOrigin: env.FRONTEND_ORIGIN,
  now: () => new Date(),
});
server.listen(env.PORT, env.HOST);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    phishingWebSocket.close();
    closePrivacySessionGateway();
    closeVirusSessionGateway();
    server.close(() => {
      void prisma.$disconnect().finally(() => process.exit(0));
    });
  });
}
