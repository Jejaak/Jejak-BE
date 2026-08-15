import type { Request, RequestHandler } from 'express';
import { AppError } from '../../middleware/errors.js';
import type { VirusSessionService } from './virus-session.service.js';
import { virusActionSchema, virusPublicIdSchema, virusSessionIdSchema } from './virus-session.validation.js';

function userId(req: Request): string {
  if (!req.authContext) throw new AppError(401, 'unauthorized', 'Authentication required.');
  return req.authContext.userId;
}

export class VirusSessionController {
  public constructor(
    private readonly service: VirusSessionService,
    private readonly now: () => Date,
  ) {}

  public readonly start: RequestHandler = async (req, res) => {
    res.status(201).json({ data: await this.service.start(userId(req), this.now()) });
  };

  public readonly getActive: RequestHandler = async (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    const publicId = virusPublicIdSchema.parse(req.params.publicId);
    const session = await this.service.getActive(userId(req), publicId);
    if (!session) throw new AppError(404, 'virus_session_unavailable', 'Virus session is expired, ended, or unavailable.');
    res.status(200).json({ data: session });
  };

  public readonly abandon: RequestHandler = async (req, res) => {
    const sessionId = virusSessionIdSchema.parse(req.params.sessionId);
    const abandoned = await this.service.abandon(userId(req), sessionId, this.now());
    if (!abandoned) throw new AppError(404, 'virus_session_not_found', 'Active virus session not found.');
    res.status(204).end();
  };

  public readonly act: RequestHandler = async (req, res) => {
    const sessionId = virusSessionIdSchema.parse(req.params.sessionId);
    const input = virusActionSchema.parse(req.body);
    const result = await this.service.act(userId(req), sessionId, input.fileId, input.action, this.now());
    if (!result) throw new AppError(404, 'virus_session_not_found', 'Active virus session or file not found.');
    res.status(200).json({ data: result });
  };
}
