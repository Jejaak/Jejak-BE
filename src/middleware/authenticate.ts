import type { RequestHandler } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import type { AuthSessionProvider } from '../types/auth.js';
import { AppError, asyncHandler } from './errors.js';

export function authenticate(auth: AuthSessionProvider): RequestHandler {
  return asyncHandler(async (req, _res, next) => {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    if (!session) throw new AppError(401, 'unauthorized', 'Authentication required.');
    req.authContext = {
      userId: session.user.id,
      sessionId: session.session.id,
    };
    next();
  });
}
