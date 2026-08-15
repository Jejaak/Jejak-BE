import { AppError } from '../../middleware/errors.js';
import type { PhishingEvents } from './phishing.events.js';
import type { PhishingRepository, PhishingQuestionRecord, PhishingSessionRecord } from './phishing.repository.js';
import { phishingClueSchema, type CreatePhishingAnswerRequest } from './phishing.validation.js';

function clues(question: PhishingQuestionRecord) {
  const parsed = phishingClueSchema.array().safeParse(question.clues);
  if (!parsed.success) throw new AppError(500, 'invalid_question_data', 'Phishing question data is invalid.');
  return parsed.data;
}

function publicQuestion(question: PhishingQuestionRecord) {
  return {
    id: question.id,
    senderName: question.senderName,
    senderEmail: question.senderEmail,
    senderAsset: question.senderAsset,
    subject: question.subject,
    preview: question.preview,
    greeting: question.greeting,
    body: question.body,
    action: question.action,
    attachment: question.attachmentName && question.attachmentAsset
      ? { name: question.attachmentName, asset: question.attachmentAsset }
      : null,
  };
}

export function publicPhishingSession(session: PhishingSessionRecord) {
  return {
    id: session.id,
    publicId: session.publicId,
    status: session.status,
    startedAt: session.startedAt,
    completedAt: session.completedAt,
    answeredCount: session.answeredCount,
    score: session.score,
    mistakes: session.answeredCount - session.score,
    questions: session.sessionQuestions.map(({ question }) => publicQuestion(question)),
    answers: session.answers.map((answer) => {
      const question = session.sessionQuestions.find((item) => item.question.id === answer.questionId)?.question;
      if (!question) throw new AppError(500, 'invalid_session_data', 'Phishing session data is invalid.');
      return {
        questionId: answer.questionId,
        selectedClueIds: answer.selectedClueIds,
        markedSuspicious: answer.markedSuspicious,
        correct: answer.correct,
        answeredAt: answer.answeredAt,
        suspicious: question.suspicious,
        explanation: question.explanation,
        clues: clues(question),
      };
    }),
  };
}

export class PhishingService {
  public constructor(
    private readonly repository: PhishingRepository,
    private readonly events: PhishingEvents,
  ) {}

  public async start(userId: string, now: Date, restart: boolean) {
    return publicPhishingSession(await this.repository.startSession(userId, now, restart));
  }

  public async getSession(userId: string, publicId: string) {
    const session = await this.repository.findSessionByPublicId(publicId, userId);
    return session ? publicPhishingSession(session) : null;
  }

  public async answer(
    userId: string,
    publicId: string,
    idempotencyKey: string,
    input: CreatePhishingAnswerRequest,
    answeredAt: Date,
  ) {
    const context = await this.repository.findAnswerContext(publicId, userId, input.questionId);
    if (!context) throw new AppError(404, 'question_not_found', 'Question is not part of this phishing session.');
    if (context.previousAnswer && context.previousAnswer.idempotencyKey !== idempotencyKey) {
      throw new AppError(409, 'question_already_answered', 'This phishing question has already been answered.');
    }

    const expectedClueIds = clues(context.question).map(({ id }) => id);
    const selected = new Set(input.selectedClueIds);
    const cluesCorrect = expectedClueIds.length === selected.size && expectedClueIds.every((id) => selected.has(id));
    const correct = input.markedSuspicious === context.question.suspicious && cluesCorrect;
    const saved = await this.repository.saveAnswer({
      sessionId: context.sessionId,
      userId,
      questionId: context.question.id,
      idempotencyKey,
      selectedClueIds: input.selectedClueIds,
      markedSuspicious: input.markedSuspicious,
      correct,
      answeredAt,
    });
    const payload = {
      type: saved.status === 'LOST'
        ? 'phishing.session.lost' as const
        : saved.status === 'COMPLETED'
          ? 'phishing.session.completed' as const
          : 'phishing.answer.saved' as const,
      sessionId: context.publicId,
      questionId: saved.answer.questionId,
      selectedClueIds: saved.answer.selectedClueIds,
      markedSuspicious: saved.answer.markedSuspicious,
      correct: saved.answer.correct,
      answeredCount: saved.answeredCount,
      score: saved.score,
      mistakes: saved.answeredCount - saved.score,
      status: saved.status,
      suspicious: context.question.suspicious,
      explanation: context.question.explanation,
      clues: clues(context.question),
    };
    if (!saved.replayed) this.events.publish({ publicId: context.publicId, userId, payload });
    return payload;
  }
}
