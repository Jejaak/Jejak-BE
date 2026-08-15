import type { RequestHandler } from 'express';
import { AppError } from './errors.js';

export function exactMutationOrigin(frontendOrigin: string): RequestHandler {
  return (req, _res, next) => {
    if (req.get('origin') !== frontendOrigin) {
      next(new AppError(403, 'origin_forbidden', 'Request origin is not allowed.'));
      return;
    }
    next();
  };
}
