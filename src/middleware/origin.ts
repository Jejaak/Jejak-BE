import type { RequestHandler } from 'express';
import { AppError } from './errors.js';

export function exactMutationOrigin(frontendOrigins: readonly string[]): RequestHandler {
  const allowedOrigins = new Set(frontendOrigins);
  return (req, _res, next) => {
    if (!allowedOrigins.has(req.get('origin') ?? '')) {
      next(new AppError(403, 'origin_forbidden', 'Request origin is not allowed.'));
      return;
    }
    next();
  };
}
