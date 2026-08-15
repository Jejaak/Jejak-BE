import type { RequestHandler } from 'express';

export function requestIdMiddleware(createId: () => string): RequestHandler {
  return (req, res, next) => {
    req.requestId = createId();
    res.setHeader('X-Request-Id', req.requestId);
    next();
  };
}
