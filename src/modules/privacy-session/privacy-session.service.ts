import { AppError } from '../../middleware/errors.js';
import type { PrivacySessionRecord, PrivacySessionRepository } from './privacy-session.repository.js';
import type { PrivacyAnswerRequest } from './privacy-session.validation.js';

function answeredCount(session: PrivacySessionRecord): number {
  return session.sessionQuestions.filter((question) => question.selectedChoice !== null).length;
}

function publicSession(session: PrivacySessionRecord) {
  const completedQuestions = answeredCount(session);
  return {
    id: session.id,
    publicId: session.publicId,
    status: session.status,
    questionCount: session.questionCount,
    answeredCount: completedQuestions,
    resumePosition: Math.min(completedQuestions + 1, session.questionCount),
    score: session.score,
    mistakes: session.mistakes,
    questions: session.sessionQuestions.map((sessionQuestion) => ({
      id: sessionQuestion.question.id,
      position: sessionQuestion.position,
      characterName: sessionQuestion.question.characterName,
      characterAsset: sessionQuestion.question.characterAsset,
      accountAge: sessionQuestion.question.accountAge,
      relationship: sessionQuestion.question.relationship,
      prompt: sessionQuestion.question.prompt,
    })),
  };
}

export class PrivacySessionService {
  public constructor(private readonly repository: PrivacySessionRepository) {}

  public async start(userId: string) {
    const result = await this.repository.start(userId);
    if (result.kind === 'insufficient_questions') {
      throw new AppError(503, 'privacy_questions_unavailable', 'Privacy question bank is unavailable.');
    }
    return publicSession(result.session);
  }

  public async getActive(userId: string, publicId: string) {
    const session = await this.repository.findActiveByPublicId(publicId, userId);
    return session ? publicSession(session) : null;
  }

  public async answer(
    userId: string,
    sessionId: string,
    idempotencyKey: string,
    input: PrivacyAnswerRequest,
    answeredAt: Date,
  ) {
    const result = await this.repository.answer({
      userId,
      sessionId,
      questionId: input.questionId,
      choice: input.choice,
      idempotencyKey,
      answeredAt,
    });
    if (result.kind === 'not_found') {
      throw new AppError(404, 'privacy_session_not_found', 'Privacy session was not found.');
    }
    if (result.kind === 'inactive') {
      throw new AppError(409, 'privacy_session_inactive', 'Privacy session is not active.');
    }
    if (result.kind === 'question_not_next') {
      throw new AppError(409, 'privacy_question_not_next', 'Privacy question cannot be answered.');
    }
    if (result.kind === 'idempotency_conflict') {
      throw new AppError(409, 'idempotency_conflict', 'Idempotency-Key has already been used.');
    }
    if (result.kind === 'answer_conflict') {
      throw new AppError(409, 'privacy_answer_conflict', 'Privacy answer could not be saved.');
    }

    return {
      correct: result.answer.correct,
      explanation: result.answer.explanation,
      feedback: result.answer.correctFeedback,
      session: {
        id: result.answer.sessionId,
        publicId: result.answer.publicId,
        status: result.answer.status,
        answeredCount: result.answer.answeredCount,
        score: result.answer.score,
        mistakes: result.answer.mistakes,
      },
    };
  }

  public async abandon(userId: string, sessionId: string) {
    const result = await this.repository.abandon(userId, sessionId);
    if (result.kind === 'not_found') {
      throw new AppError(404, 'privacy_session_not_found', 'Privacy session was not found.');
    }
    if (result.kind === 'completed') {
      throw new AppError(409, 'privacy_session_completed', 'Privacy session is already completed.');
    }
    return { id: result.session.id, status: result.session.status };
  }
}
