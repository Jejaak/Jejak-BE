import { z } from 'zod';

export const privacySessionIdSchema = z.uuid();
export const privacyPublicIdSchema = z.string().regex(/^PRV-[A-F0-9]{6}-[A-F0-9]{6}-[A-F0-9]{4}$/u);

export const privacyAnswerSchema = z
  .object({
    questionId: z.string().trim().min(1).max(64),
    choice: z.enum(['SHARE', 'REJECT']),
  })
  .strict();

export type PrivacyAnswerRequest = z.infer<typeof privacyAnswerSchema>;
