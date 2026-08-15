import { Router, type RequestHandler } from 'express';
import { asyncHandler } from '../../middleware/errors.js';
import type { PhishingController } from './phishing.controller.js';

export function createPhishingRouter(
  controller: PhishingController,
  requireMutationOrigin: RequestHandler,
): Router {
  const router = Router();
  router.post('/phishing-sessions', requireMutationOrigin, asyncHandler(controller.start));
  router.get('/phishing-sessions/:sessionId', asyncHandler(controller.get));
  router.post('/phishing-sessions/:sessionId/answers', requireMutationOrigin, asyncHandler(controller.answer));
  return router;
}
