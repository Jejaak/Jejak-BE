import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';

export class AppError extends Error {
  public constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export function asyncHandler(handler: RequestHandler): RequestHandler {
  return (req, res, next) => void Promise.resolve(handler(req, res, next)).catch(next);
}

export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(new AppError(404, 'not_found', 'Resource not found.'));
};

function bodyParserError(error: unknown, type: string): boolean {
  return typeof error === 'object' && error !== null && 'type' in error && error.type === type;
}

function errorCode(error: unknown): string | null {
  return typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
    ? error.code
    : null;
}

export const errorHandler: ErrorRequestHandler = (error: unknown, req, res, next) => {
  void next;
  if (error instanceof AppError) {
    res.status(error.status).json({
      error: { code: error.code, message: error.message, requestId: req.requestId },
    });
    return;
  }
  if (error instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'validation_error',
        message: 'Invalid request.',
        fields: Object.fromEntries(
          error.issues.map((issue) => [issue.path.join('.') || 'request', issue.message]),
        ),
        requestId: req.requestId,
      },
    });
    return;
  }
  if (bodyParserError(error, 'entity.too.large')) {
    res.status(413).json({
      error: {
        code: 'payload_too_large',
        message: 'Request body is too large.',
        requestId: req.requestId,
      },
    });
    return;
  }
  if (bodyParserError(error, 'entity.parse.failed')) {
    res.status(400).json({
      error: {
        code: 'malformed_json',
        message: 'Request body must be valid JSON.',
        requestId: req.requestId,
      },
    });
    return;
  }
  const code = errorCode(error);
  if (code === 'P2028') {
    console.error('Database transaction unavailable.', { code, requestId: req.requestId });
    res.status(503).json({
      error: {
        code: 'database_busy',
        message: 'Server is busy. Please try again.',
        requestId: req.requestId,
      },
    });
    return;
  }
  if (code) console.error('Unhandled server error.', { code, requestId: req.requestId });
  res.status(500).json({
    error: {
      code: 'internal_error',
      message: 'Internal server error.',
      requestId: req.requestId,
    },
  });
};
