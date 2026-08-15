import { Router, type RequestHandler } from 'express';
import { asyncHandler } from '../../middleware/errors.js';
import type { PrivacySessionController } from './privacy-session.controller.js';

export function createPrivacySessionRouter(
  controller: PrivacySessionController,
  requireMutationOrigin: RequestHandler,
): Router {
  const router = Router();
  router.post('/privacy-sessions', requireMutationOrigin, asyncHandler(controller.start));
  router.get('/privacy-sessions/public/:publicId', asyncHandler(controller.getActive));
  router.post(
    '/privacy-sessions/:sessionId/answers',
    requireMutationOrigin,
    asyncHandler(controller.answer),
  );
  router.post(
    '/privacy-sessions/:sessionId/abandon',
    requireMutationOrigin,
    asyncHandler(controller.abandon),
  );
  return router;
}
