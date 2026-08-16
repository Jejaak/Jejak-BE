import type { Request, RequestHandler } from 'express';
import { AppError } from '../../middleware/errors.js';
import { idempotencyKeySchema } from '../progress/progress.validation.js';
import type { PhishingService } from './phishing.service.js';
import { createPhishingAnswerSchema, phishingSessionIdSchema, startPhishingSessionSchema } from './phishing.validation.js';

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

export class PhishingController {
  public constructor(
    private readonly service: PhishingService,
    private readonly now: () => Date,
  ) {}

  public readonly start: RequestHandler = async (req, res) => {
    const input = startPhishingSessionSchema.parse(req.body ?? {});
    res.status(201).json({ data: await this.service.start(userId(req), this.now(), input.restart) });
  };

  public readonly get: RequestHandler = async (req, res) => {
    const publicId = phishingSessionIdSchema.parse(req.params.sessionId);
    const session = await this.service.getSession(userId(req), publicId);
    if (!session) throw new AppError(404, 'phishing_session_not_found', 'Phishing session was not found.');
    res.set('Cache-Control', 'no-store');
    res.status(200).json({ data: session });
  };

  public readonly abandon: RequestHandler = async (req, res) => {
    const publicId = phishingSessionIdSchema.parse(req.params.sessionId);
    const abandoned = await this.service.abandon(userId(req), publicId, this.now());
    if (!abandoned) throw new AppError(404, 'phishing_session_not_found', 'Active phishing session was not found.');
    res.status(200).json({ data: { publicId, status: 'ABANDONED' } });
  };

  public readonly answer: RequestHandler = async (req, res) => {
    const publicId = phishingSessionIdSchema.parse(req.params.sessionId);
    const input = createPhishingAnswerSchema.parse(req.body);
    const result = await this.service.answer(userId(req), publicId, idempotencyKey(req), input, this.now());
    res.status(201).json({ data: result });
  };
}
