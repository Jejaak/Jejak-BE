import type { RequestHandler } from 'express';
import { getRequest, setResponse } from 'better-call/node';
import { AppError } from '../middleware/errors.js';
import type { Auth } from './auth.js';

export function createAuthHandler(auth: Auth, bodySizeLimit: number): RequestHandler {
  return (req, res, next) => {
    const reject = (error: unknown) => {
      if (error instanceof Error && /body size|content-length|size exceeded/iu.test(error.message)) {
        next(new AppError(413, 'payload_too_large', 'Request body is too large.'));
        return;
      }
      next(error);
    };

    try {
      const encrypted = 'encrypted' in req.socket && req.socket.encrypted === true;
      const protocol = req.headers['x-forwarded-proto'] ?? (encrypted ? 'https' : 'http');
      const authority = req.headers[':authority'] ?? req.headers.host;
      const base = `${protocol}://${authority}`;
      void auth.handler(getRequest({ request: req, base, bodySizeLimit }))
        .then((response) => setResponse(res, response))
        .catch(reject);
    } catch (error) {
      reject(error);
    }
  };
}
