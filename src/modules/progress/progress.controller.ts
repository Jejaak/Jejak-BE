import type { Request, RequestHandler } from 'express';
import { AppError } from '../../middleware/errors.js';
import type { ProgressService } from './progress.service.js';
import { createProgressSchema, idempotencyKeySchema } from './progress.validation.js';

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

export class ProgressController {
  public constructor(
    private readonly service: ProgressService,
    private readonly now: () => Date,
  ) {}

  public readonly list: RequestHandler = async (req, res) => {
    const result = await this.service.list(userId(req));
    res.status(200).json({ data: result });
  };

  public readonly create: RequestHandler = async (req, res) => {
    const input = createProgressSchema.parse(req.body);
    if (input.mode === 'PRIVACY') {
      throw new AppError(409, 'privacy_progress_session_required', 'Privacy progress is saved by the game session.');
    }
    const result = await this.service.save({
      userId: userId(req),
      idempotencyKey: idempotencyKey(req),
      ...input,
      completedAt: this.now(),
    });
    res.status(201).json({ data: result });
  };
}
