import { z } from 'zod';

export const phishingClueSchema = z.object({
  id: z.enum(['sender', 'subject', 'body', 'action', 'attachment']),
  label: z.string().trim().min(1).max(100),
  text: z.string().trim().min(1).max(240),
}).strict();

export const phishingSessionIdSchema = z.string().trim().regex(/^PH-[A-F0-9]{6}-[A-F0-9]{6}-[A-F0-9]{4}$/u);
export const startPhishingSessionSchema = z.object({ restart: z.boolean().optional().default(false) }).strict();

export const createPhishingAnswerSchema = z.object({
  questionId: z.string().trim().min(1).max(64).regex(/^[a-z0-9-]+$/u),
  selectedClueIds: z.array(phishingClueSchema.shape.id).max(5),
  markedSuspicious: z.boolean(),
}).strict().superRefine((value, context) => {
  if (new Set(value.selectedClueIds).size !== value.selectedClueIds.length) {
    context.addIssue({ code: 'custom', path: ['selectedClueIds'], message: 'Clue IDs must be unique.' });
  }
  if (value.markedSuspicious && value.selectedClueIds.length === 0) {
    context.addIssue({ code: 'custom', path: ['selectedClueIds'], message: 'At least one clue is required.' });
  }
  if (!value.markedSuspicious && value.selectedClueIds.length > 0) {
    context.addIssue({ code: 'custom', path: ['selectedClueIds'], message: 'Trusted emails cannot include suspicious clues.' });
  }
});

export type CreatePhishingAnswerRequest = z.infer<typeof createPhishingAnswerSchema>;
