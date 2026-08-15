import { Router, type RequestHandler } from 'express';
import { asyncHandler } from '../../middleware/errors.js';
import type { ProgressController } from './progress.controller.js';

export function createProgressRouter(
  controller: ProgressController,
  requireMutationOrigin: RequestHandler,
): Router {
  const router = Router();
  router.get('/progress', asyncHandler(controller.list));
  router.post('/progress', requireMutationOrigin, asyncHandler(controller.create));
  return router;
}
