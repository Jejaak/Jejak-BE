import { z } from 'zod';

export const gameModes = ['PRIVACY', 'PHISHING', 'DOWNLOADS'] as const;
export type GameMode = (typeof gameModes)[number];

const commonFields = {
  score: z.number().int().min(0),
  mistakes: z.number().int().min(0),
  durationMs: z.number().int().positive().max(86_400_000),
};

export const createProgressSchema = z.discriminatedUnion('mode', [
  z
    .object({
      mode: z.literal('PRIVACY'),
      ...commonFields,
      score: commonFields.score.max(15),
      maxScore: z.literal(15),
      mistakes: commonFields.mistakes.max(15),
    })
    .strict(),
  z
    .object({
      mode: z.literal('PHISHING'),
      ...commonFields,
      score: commonFields.score.max(15),
      maxScore: z.literal(15),
      mistakes: commonFields.mistakes.max(15),
    })
    .strict(),
  z
    .object({
      mode: z.literal('DOWNLOADS'),
      ...commonFields,
      score: commonFields.score.max(15),
      maxScore: z.literal(15),
      mistakes: commonFields.mistakes.max(3),
    })
    .strict(),
]);

export const idempotencyKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9._:-]+$/u);

export type CreateProgressRequest = z.infer<typeof createProgressSchema>;
