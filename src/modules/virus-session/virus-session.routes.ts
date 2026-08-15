import { Router, type RequestHandler } from 'express';
import { asyncHandler } from '../../middleware/errors.js';
import type { VirusSessionController } from './virus-session.controller.js';

export function createVirusSessionRouter(
  controller: VirusSessionController,
  requireMutationOrigin: RequestHandler,
): Router {
  const router = Router();
  router.post('/virus-sessions', requireMutationOrigin, asyncHandler(controller.start));
  router.get('/virus-sessions/public/:publicId', asyncHandler(controller.getActive));
  router.post('/virus-sessions/:sessionId/abandon', requireMutationOrigin, asyncHandler(controller.abandon));
  router.post('/virus-sessions/:sessionId/actions', requireMutationOrigin, asyncHandler(controller.act));
  return router;
}
