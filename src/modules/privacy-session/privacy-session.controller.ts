import type { Request, RequestHandler } from 'express';
import { AppError } from '../../middleware/errors.js';
import { idempotencyKeySchema } from '../progress/progress.validation.js';
import type { PrivacySessionService } from './privacy-session.service.js';
import { privacyAnswerSchema, privacyPublicIdSchema, privacySessionIdSchema } from './privacy-session.validation.js';

function userId(req: Request): string {
  if (!req.authContext) throw new AppError(401, 'unauthorized', 'Authentication required.');
  return req.authContext.userId;
}

function idempotencyKey(req: Request): string {
  const parsed = idempotencyKeySchema.safeParse(req.get('idempotency-key'));
  if (!parsed.success) {
    throw new AppError(400, 'idempotency_key_required', 'A valid Idempotency-Key header is required.');
  }
  return parsed.data;
}

export class PrivacySessionController {
  public constructor(
    private readonly service: PrivacySessionService,
    private readonly now: () => Date,
  ) {}

  public readonly start: RequestHandler = async (req, res) => {
    res.status(200).json({ data: await this.service.start(userId(req)) });
  };

  public readonly getActive: RequestHandler = async (req, res) => {
    const publicId = privacyPublicIdSchema.parse(req.params.publicId);
    const session = await this.service.getActive(userId(req), publicId);
    if (!session) throw new AppError(404, 'privacy_session_not_found', 'Active privacy session was not found.');
    res.status(200).json({ data: session });
  };

  public readonly completeTutorial: RequestHandler = async (req, res) => {
    const sessionId = privacySessionIdSchema.parse(req.params.sessionId);
    res.status(200).json({ data: await this.service.completeTutorial(userId(req), sessionId, this.now()) });
  };

  public readonly answer: RequestHandler = async (req, res) => {
    const sessionId = privacySessionIdSchema.parse(req.params.sessionId);
    const input = privacyAnswerSchema.parse(req.body);
    const result = await this.service.answer(
      userId(req),
      sessionId,
      idempotencyKey(req),
      input,
      this.now(),
    );
    res.status(200).json({ data: result });
  };

  public readonly abandon: RequestHandler = async (req, res) => {
    const sessionId = privacySessionIdSchema.parse(req.params.sessionId);
    res.status(200).json({ data: await this.service.abandon(userId(req), sessionId) });
  };
}
