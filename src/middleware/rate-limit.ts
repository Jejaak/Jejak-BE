import { rateLimit } from 'express-rate-limit';
import type { RequestHandler } from 'express';

export function createRateLimit(options: {
  readonly windowMs: number;
  readonly limit: number;
  readonly identifier: string;
}): RequestHandler {
  return rateLimit({
    windowMs: options.windowMs,
    limit: options.limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    identifier: options.identifier,
    handler: (req, res) => {
      res.status(429).json({
        error: {
          code: 'rate_limit_exceeded',
          message: 'Too many requests. Try again later.',
          requestId: req.requestId,
        },
      });
    },
  });
}
