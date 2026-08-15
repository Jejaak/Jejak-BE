import { randomBytes, randomInt } from 'node:crypto';
import { Prisma, type GameSessionStatus, type PrismaClient, type PrivacyChoice } from '../../generated/prisma/client.js';

const questionCount = 15;
const maxTransactionAttempts = 3;
const maxPublicIdAttempts = 3;

export interface PrivacySessionQuestionRecord {
  readonly id: string;
  readonly questionId: string;
  readonly position: number;
  readonly selectedChoice: PrivacyChoice | null;
  readonly correct: boolean | null;
  readonly idempotencyKey: string | null;
  readonly answeredAt: Date | null;
  readonly question: {
    readonly id: string;
    readonly characterName: string;
    readonly characterAsset: string;
    readonly accountAge: string;
    readonly relationship: string;
    readonly prompt: string;
    readonly explanation: string;
    readonly correctFeedback: string;
    readonly correctChoice: PrivacyChoice;
  };
}

export interface PrivacySessionRecord {
  readonly id: string;
  readonly publicId: string;
  readonly userId: string;
  readonly status: GameSessionStatus;
  readonly questionCount: number;
  readonly score: number;
  readonly mistakes: number;
  readonly startedAt: Date;
  readonly completedAt: Date | null;
  readonly sessionQuestions: PrivacySessionQuestionRecord[];
}

export type StartPrivacySessionResult =
  | { readonly kind: 'success'; readonly session: PrivacySessionRecord }
  | { readonly kind: 'insufficient_questions' };

export interface PrivacyAnswerRecord {
  readonly sessionId: string;
  readonly publicId: string;
  readonly status: GameSessionStatus;
  readonly answeredCount: number;
  readonly score: number;
  readonly mistakes: number;
  readonly correct: boolean;
  readonly explanation: string;
  readonly correctFeedback: string;
  readonly position: number;
}

interface PrivacyAnswerState {
  readonly sessionId: string;
  readonly publicId: string;
  readonly status: GameSessionStatus;
  readonly questionCount: number;
  readonly replayQuestionId: string | null;
  readonly replayChoice: PrivacyChoice | null;
  readonly replayPosition: number | null;
  readonly replayCorrect: boolean | null;
  readonly replayExplanation: string | null;
  readonly replayCorrectFeedback: string | null;
  readonly replayAnsweredCount: number | null;
  readonly replayScore: number | null;
  readonly replayMistakes: number | null;
  readonly nextQuestionId: string | null;
}

export type AnswerPrivacySessionResult =
  | { readonly kind: 'success'; readonly answer: PrivacyAnswerRecord; readonly replayed: boolean }
  | { readonly kind: 'not_found' }
  | { readonly kind: 'inactive' }
  | { readonly kind: 'question_not_next' }
  | { readonly kind: 'idempotency_conflict' }
  | { readonly kind: 'answer_conflict' };

export type AbandonPrivacySessionResult =
  | { readonly kind: 'success'; readonly session: PrivacySessionRecord }
  | { readonly kind: 'not_found' }
  | { readonly kind: 'completed' };

export interface PrivacySessionRepository {
  start(userId: string): Promise<StartPrivacySessionResult>;
  findActiveByPublicId(publicId: string, userId: string): Promise<PrivacySessionRecord | null>;
  answer(input: {
    userId: string;
    sessionId: string;
    questionId: string;
    choice: PrivacyChoice;
    idempotencyKey: string;
    answeredAt: Date;
  }): Promise<AnswerPrivacySessionResult>;
  abandon(userId: string, sessionId: string): Promise<AbandonPrivacySessionResult>;
}

const sessionInclude = {
  sessionQuestions: {
    include: { question: true },
    orderBy: { position: 'asc' as const },
  },
} as const;

function createPublicId(): string {
  const token = randomBytes(8).toString('hex').toUpperCase();
  return `PRV-${token.slice(0, 6)}-${token.slice(6, 12)}-${token.slice(12, 16)}`;
}

function shuffled<T>(items: readonly T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = randomInt(index + 1);
    const current = result[index];
    const replacement = result[target];
    if (current === undefined || replacement === undefined) continue;
    result[index] = replacement;
    result[target] = current;
  }
  return result;
}

function isRetryableTransactionError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';
}

function isUniqueConstraintError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

function isPublicIdCollision(error: unknown): boolean {
  if (!isUniqueConstraintError(error)) return false;
  const target = error.meta?.target;
  return Array.isArray(target) ? target.includes('publicId') : target === 'publicId';
}

export class PrismaPrivacySessionRepository implements PrivacySessionRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  private async serializable<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt < maxTransactionAttempts; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        if (!isRetryableTransactionError(error)) throw error;
        lastError = error;
      }
    }
    throw lastError;
  }

  public async start(userId: string): Promise<StartPrivacySessionResult> {
    let lastError: unknown;
    for (let attempt = 0; attempt < maxPublicIdAttempts; attempt += 1) {
      try {
        return await this.serializable(() =>
          this.prisma.$transaction(
            async (transaction) => {
              const active = await transaction.trGameSession.findFirst({
                where: { userId, mode: 'PRIVACY', status: 'ACTIVE' },
                include: sessionInclude,
                orderBy: { startedAt: 'desc' },
              });
              if (active) return { kind: 'success' as const, session: active };

              const questions = await transaction.msPrivacyQuestion.findMany({
                where: { isActive: true },
                select: { id: true },
              });
              if (questions.length < questionCount) return { kind: 'insufficient_questions' as const };

              const selected = shuffled(questions).slice(0, questionCount);
              const session = await transaction.trGameSession.create({
                data: {
                  publicId: createPublicId(),
                  userId,
                  mode: 'PRIVACY',
                  questionCount,
                  sessionQuestions: {
                    create: selected.map((question, index) => ({
                      questionId: question.id,
                      position: index + 1,
                    })),
                  },
                },
                include: sessionInclude,
              });
              return { kind: 'success' as const, session };
            },
            { isolationLevel: 'Serializable' },
          ),
        );
      } catch (error) {
        if (!isPublicIdCollision(error)) throw error;
        lastError = error;
      }
    }
    throw lastError;
  }

  public findActiveByPublicId(publicId: string, userId: string): Promise<PrivacySessionRecord | null> {
    return this.prisma.trGameSession.findFirst({
      where: { publicId, userId, mode: 'PRIVACY', status: 'ACTIVE' },
      include: sessionInclude,
    });
  }

  public async answer(input: {
    userId: string;
    sessionId: string;
    questionId: string;
    choice: PrivacyChoice;
    idempotencyKey: string;
    answeredAt: Date;
  }): Promise<AnswerPrivacySessionResult> {
    const answers = await this.prisma.$queryRaw<PrivacyAnswerRecord[]>(Prisma.sql`
      WITH locked_session AS MATERIALIZED (
        SELECT
          session."id",
          session."publicId",
          session."userId",
          session."questionCount",
          session."score",
          session."mistakes",
          session."startedAt"
        FROM "TrGameSession" AS session
        WHERE session."id" = CAST(${input.sessionId} AS uuid)
          AND session."userId" = ${input.userId}
          AND session."mode" = 'PRIVACY'::"GameMode"
          AND session."status" = 'ACTIVE'::"GameSessionStatus"
        FOR UPDATE
      ),
      replay AS MATERIALIZED (
        SELECT 1
        FROM locked_session AS session
        JOIN "TrPrivacySessionQuestion" AS session_question
          ON session_question."sessionId" = session."id"
        WHERE session_question."idempotencyKey" = ${input.idempotencyKey}
      ),
      next_question AS MATERIALIZED (
        SELECT
          session_question."id",
          session_question."sessionId",
          session_question."position",
          question."explanation",
          question."correctFeedback",
          question."correctChoice" = CAST(${input.choice} AS "PrivacyChoice") AS "correct",
          (
            SELECT COUNT(*)::integer + 1
            FROM "TrPrivacySessionQuestion" AS answered
            WHERE answered."sessionId" = session."id"
              AND answered."selectedChoice" IS NOT NULL
          ) AS "answeredCount"
        FROM locked_session AS session
        JOIN LATERAL (
          SELECT candidate.*
          FROM "TrPrivacySessionQuestion" AS candidate
          WHERE candidate."sessionId" = session."id"
            AND candidate."selectedChoice" IS NULL
          ORDER BY candidate."position"
          LIMIT 1
        ) AS session_question ON true
        JOIN "MsPrivacyQuestion" AS question
          ON question."id" = session_question."questionId"
        WHERE NOT EXISTS (SELECT 1 FROM replay)
          AND session_question."questionId" = ${input.questionId}
      ),
      saved_answer AS (
        UPDATE "TrPrivacySessionQuestion" AS session_question
        SET
          "selectedChoice" = CAST(${input.choice} AS "PrivacyChoice"),
          "correct" = next_question."correct",
          "idempotencyKey" = ${input.idempotencyKey},
          "answeredAt" = ${input.answeredAt}
        FROM next_question
        WHERE session_question."id" = next_question."id"
          AND session_question."sessionId" = next_question."sessionId"
          AND session_question."selectedChoice" IS NULL
          AND session_question."idempotencyKey" IS NULL
        RETURNING
          next_question."sessionId",
          next_question."position",
          next_question."explanation",
          next_question."correctFeedback",
          next_question."correct",
          next_question."answeredCount"
      ),
      updated_session AS (
        UPDATE "TrGameSession" AS session
        SET
          "score" = session."score" + CASE WHEN saved_answer."correct" THEN 1 ELSE 0 END,
          "mistakes" = session."mistakes" + CASE WHEN saved_answer."correct" THEN 0 ELSE 1 END,
          "status" = CASE
            WHEN saved_answer."answeredCount" = session."questionCount"
              THEN 'COMPLETED'::"GameSessionStatus"
            ELSE 'ACTIVE'::"GameSessionStatus"
          END,
          "completedAt" = CASE
            WHEN saved_answer."answeredCount" = session."questionCount" THEN CAST(${input.answeredAt} AS timestamp(3))
            ELSE NULL::timestamp(3)
          END,
          "updatedAt" = CAST(${input.answeredAt} AS timestamp(3))
        FROM saved_answer
        WHERE session."id" = saved_answer."sessionId"
        RETURNING
          session."id",
          session."publicId",
          session."userId",
          session."status",
          session."questionCount",
          session."score",
          session."mistakes",
          session."startedAt"
      ),
      progress AS (
        INSERT INTO "GameProgress" (
          "userId",
          "idempotencyKey",
          "mode",
          "score",
          "maxScore",
          "mistakes",
          "durationMs",
          "completedAt"
        )
        SELECT
          updated_session."userId",
          'privacy-session:' || updated_session."id"::text,
          'PRIVACY'::"GameMode",
          updated_session."score",
          ${questionCount},
          updated_session."mistakes",
          LEAST(
            86400000::numeric,
            GREATEST(
              1::numeric,
              FLOOR(EXTRACT(EPOCH FROM (${input.answeredAt} - updated_session."startedAt")) * 1000)
            )
          )::integer,
          ${input.answeredAt}
        FROM updated_session
        WHERE updated_session."status" = 'COMPLETED'::"GameSessionStatus"
        ON CONFLICT ("userId", "idempotencyKey") DO NOTHING
      )
      SELECT
        updated_session."id" AS "sessionId",
        updated_session."publicId",
        updated_session."status",
        saved_answer."answeredCount",
        updated_session."score",
        updated_session."mistakes",
        saved_answer."correct",
        saved_answer."explanation",
        saved_answer."correctFeedback",
        saved_answer."position"
      FROM updated_session
      JOIN saved_answer ON saved_answer."sessionId" = updated_session."id"
    `);
    const answer = answers[0];
    if (answer) return { kind: 'success', answer, replayed: false };

    const states = await this.prisma.$queryRaw<PrivacyAnswerState[]>(Prisma.sql`
      SELECT
        session."status",
        session."questionCount",
        replay."questionId" AS "replayQuestionId",
        replay."selectedChoice" AS "replayChoice",
        replay."position" AS "replayPosition",
        replay."correct" AS "replayCorrect",
        replay."explanation" AS "replayExplanation",
        replay."correctFeedback" AS "replayCorrectFeedback",
        replay."answeredCount" AS "replayAnsweredCount",
        replay."score" AS "replayScore",
        replay."mistakes" AS "replayMistakes",
        next_question."questionId" AS "nextQuestionId",
        session."id" AS "sessionId",
        session."publicId"
      FROM "TrGameSession" AS session
      LEFT JOIN LATERAL (
        SELECT
          session_question."questionId",
          session_question."selectedChoice",
          session_question."position",
          session_question."correct",
          question."explanation",
          question."correctFeedback",
          COUNT(*) FILTER (
            WHERE answered."position" <= session_question."position"
              AND answered."selectedChoice" IS NOT NULL
          )::integer AS "answeredCount",
          COUNT(*) FILTER (
            WHERE answered."position" <= session_question."position"
              AND answered."correct" = true
          )::integer AS "score",
          COUNT(*) FILTER (
            WHERE answered."position" <= session_question."position"
              AND answered."correct" = false
          )::integer AS "mistakes"
        FROM "TrPrivacySessionQuestion" AS session_question
        JOIN "MsPrivacyQuestion" AS question
          ON question."id" = session_question."questionId"
        JOIN "TrPrivacySessionQuestion" AS answered
          ON answered."sessionId" = session_question."sessionId"
        WHERE session_question."sessionId" = session."id"
          AND session_question."idempotencyKey" = ${input.idempotencyKey}
        GROUP BY session_question."id", question."id"
        LIMIT 1
      ) AS replay ON true
      LEFT JOIN LATERAL (
        SELECT session_question."questionId"
        FROM "TrPrivacySessionQuestion" AS session_question
        WHERE session_question."sessionId" = session."id"
          AND session_question."selectedChoice" IS NULL
        ORDER BY session_question."position"
        LIMIT 1
      ) AS next_question ON true
      WHERE session."id" = CAST(${input.sessionId} AS uuid)
        AND session."userId" = ${input.userId}
        AND session."mode" = 'PRIVACY'::"GameMode"
    `);
    const state = states[0];
    if (!state) return { kind: 'not_found' };
    if (state.replayQuestionId !== null) {
      if (state.replayQuestionId !== input.questionId || state.replayChoice !== input.choice) {
        return { kind: 'idempotency_conflict' };
      }
      if (
        state.replayPosition === null ||
        state.replayCorrect === null ||
        state.replayExplanation === null ||
        state.replayCorrectFeedback === null ||
        state.replayAnsweredCount === null ||
        state.replayScore === null ||
        state.replayMistakes === null
      ) {
        return { kind: 'answer_conflict' };
      }
      return {
        kind: 'success',
        replayed: true,
        answer: {
          sessionId: state.sessionId,
          publicId: state.publicId,
          status: state.replayPosition === state.questionCount ? 'COMPLETED' : 'ACTIVE',
          answeredCount: state.replayAnsweredCount,
          score: state.replayScore,
          mistakes: state.replayMistakes,
          correct: state.replayCorrect,
          explanation: state.replayExplanation,
          correctFeedback: state.replayCorrectFeedback,
          position: state.replayPosition,
        },
      };
    }
    if (state.status !== 'ACTIVE') return { kind: 'inactive' };
    if (state.nextQuestionId !== input.questionId) return { kind: 'question_not_next' };
    return { kind: 'answer_conflict' };
  }

  public abandon(userId: string, sessionId: string): Promise<AbandonPrivacySessionResult> {
    return this.serializable(() =>
      this.prisma.$transaction(
        async (transaction) => {
          const session = await transaction.trGameSession.findFirst({
            where: { id: sessionId, userId, mode: 'PRIVACY' },
            include: sessionInclude,
          });
          if (!session) return { kind: 'not_found' as const };
          if (session.status === 'ABANDONED') return { kind: 'success' as const, session };
          if (session.status === 'COMPLETED') return { kind: 'completed' as const };

          await transaction.trGameSession.delete({ where: { id: session.id } });
          return { kind: 'success' as const, session: { ...session, status: 'ABANDONED' as const } };
        },
        { isolationLevel: 'Serializable' },
      ),
    );
  }
}
