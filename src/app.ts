import { randomUUID } from 'node:crypto';
import cors from 'cors';
import express, { type RequestHandler } from 'express';
import helmet from 'helmet';
import { authenticate } from './middleware/authenticate.js';
import { errorHandler, notFoundHandler } from './middleware/errors.js';
import { prettyHttpLogger } from './middleware/http-logger.js';
import { exactMutationOrigin } from './middleware/origin.js';
import { createRateLimit } from './middleware/rate-limit.js';
import { requestIdMiddleware } from './middleware/request-id.js';
import { PhishingController } from './modules/phishing/phishing.controller.js';
import type { PhishingEvents } from './modules/phishing/phishing.events.js';
import type { PhishingRepository } from './modules/phishing/phishing.repository.js';
import { createPhishingRouter } from './modules/phishing/phishing.routes.js';
import { PhishingService } from './modules/phishing/phishing.service.js';
import { PrivacySessionController } from './modules/privacy-session/privacy-session.controller.js';
import type { PrivacySessionRepository } from './modules/privacy-session/privacy-session.repository.js';
import { createPrivacySessionRouter } from './modules/privacy-session/privacy-session.routes.js';
import { PrivacySessionService } from './modules/privacy-session/privacy-session.service.js';
import { ProgressController } from './modules/progress/progress.controller.js';
import type { ProgressRepository } from './modules/progress/progress.repository.js';
import { createProgressRouter } from './modules/progress/progress.routes.js';
import { ProgressService } from './modules/progress/progress.service.js';
import { VirusSessionController } from './modules/virus-session/virus-session.controller.js';
import type { VirusSessionRepository } from './modules/virus-session/virus-session.repository.js';
import { createVirusSessionRouter } from './modules/virus-session/virus-session.routes.js';
import { VirusSessionService } from './modules/virus-session/virus-session.service.js';
import type { AuthSessionProvider } from './types/auth.js';

export interface AppDependencies {
  readonly config: {
    readonly frontendOrigins: readonly string[];
    readonly trustProxyHops: number;
    readonly jsonBodyLimit: string;
    readonly apiRateLimitMax: number;
    readonly apiRateLimitWindowMs: number;
    readonly authRateLimitMax: number;
    readonly authRateLimitWindowMs: number;
  };
  readonly auth: AuthSessionProvider;
  readonly authHandler: RequestHandler;
  readonly phishingEvents: PhishingEvents;
  readonly phishingRepository: PhishingRepository;
  readonly phishingService?: PhishingService;
  readonly privacySessionRepository: PrivacySessionRepository;
  readonly privacySessionService?: PrivacySessionService;
  readonly progressRepository: ProgressRepository;
  readonly virusSessionRepository: VirusSessionRepository;
  readonly now?: () => Date;
  readonly requestId?: () => string;
}

export function createApp(dependencies: AppDependencies) {
  const app = express();
  const now = dependencies.now ?? (() => new Date());
  const phishingController = new PhishingController(
    dependencies.phishingService ?? new PhishingService(dependencies.phishingRepository, dependencies.phishingEvents),
    now,
  );
  const privacySessionController = new PrivacySessionController(
    dependencies.privacySessionService ?? new PrivacySessionService(dependencies.privacySessionRepository),
    now,
  );
  const progressController = new ProgressController(
    new ProgressService(dependencies.progressRepository),
    now,
  );
  const virusSessionController = new VirusSessionController(
    new VirusSessionService(dependencies.virusSessionRepository),
    now,
  );


  app.disable('x-powered-by');
  if (dependencies.config.trustProxyHops > 0) app.set('trust proxy', dependencies.config.trustProxyHops);
  app.use(requestIdMiddleware(dependencies.requestId ?? randomUUID));
  app.use(prettyHttpLogger);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'none'"],
          frameAncestors: ["'none'"],
          objectSrc: ["'none'"],
        },
      },
    }),
  );
  app.use(
    cors({
      origin: (origin, callback) => {
        callback(null, origin === undefined || dependencies.config.frontendOrigins.includes(origin));
      },
      credentials: true,
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Idempotency-Key'],
    }),
  );
  app.get('/healthz', (_req, res) => res.status(200).json({ status: 'ok' }));
  app.all(
    '/api/auth/*splat',
    createRateLimit({
      windowMs: dependencies.config.authRateLimitWindowMs,
      limit: dependencies.config.authRateLimitMax,
      identifier: 'auth',
    }),
    dependencies.authHandler,
  );
  app.use(
    express.json({
      limit: dependencies.config.jsonBodyLimit,
      strict: true,
      type: 'application/json',
    }),
  );
  app.use(
    '/api/v1',
    createRateLimit({
      windowMs: dependencies.config.apiRateLimitWindowMs,
      limit: dependencies.config.apiRateLimitMax,
      identifier: 'api',
    }),
    authenticate(dependencies.auth),
    createPhishingRouter(
      phishingController,
      exactMutationOrigin(dependencies.config.frontendOrigins),
    ),
    createPrivacySessionRouter(
      privacySessionController,
      exactMutationOrigin(dependencies.config.frontendOrigins),
    ),
    createProgressRouter(
      progressController,
      exactMutationOrigin(dependencies.config.frontendOrigins),
    ),
    createVirusSessionRouter(
      virusSessionController,
      exactMutationOrigin(dependencies.config.frontendOrigins),
    ),
  );
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
