import { z } from 'zod';

export const virusActionSchema = z
  .object({
    fileId: z.string().trim().min(1).max(64),
    action: z.enum(['ALLOW', 'BLOCK']),
  })
  .strict();

export const virusSessionIdSchema = z.uuid();
export const virusPublicIdSchema = z.string().regex(/^VRS-[A-F0-9]{6}-[A-F0-9]{6}-[A-F0-9]{4}$/u);

export type VirusActionRequest = z.infer<typeof virusActionSchema>;
