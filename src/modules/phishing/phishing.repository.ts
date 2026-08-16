import { randomBytes } from 'node:crypto';
import type { GameSessionStatus, PrismaClient } from '../../generated/prisma/client.js';

export interface PhishingQuestionRecord {
  readonly id: string;
  readonly senderName: string;
  readonly senderEmail: string;
  readonly senderAsset: string;
  readonly subject: string;
  readonly preview: string;
  readonly greeting: string;
  readonly body: string;
  readonly action: string;
  readonly attachmentName: string | null;
  readonly attachmentAsset: string | null;
  readonly suspicious: boolean;
  readonly explanation: string;
  readonly clues: unknown;
}

export interface PhishingAnswerRecord {
  readonly idempotencyKey: string;
  readonly questionId: string;
  readonly selectedClueIds: string[];
  readonly markedSuspicious: boolean;
  readonly correct: boolean;
  readonly answeredAt: Date;
}

export interface PhishingSessionRecord {
  readonly id: string;
  readonly publicId: string;
  readonly userId: string;
  readonly status: GameSessionStatus;
  readonly answeredCount: number;
  readonly score: number;
  readonly startedAt: Date;
  readonly completedAt: Date | null;
  readonly sessionQuestions: ReadonlyArray<{
    readonly position: number;
    readonly question: PhishingQuestionRecord;
  }>;
  readonly answers: PhishingAnswerRecord[];
}

export interface SavePhishingAnswerData {
  readonly sessionId: string;
  readonly userId: string;
  readonly questionId: string;
  readonly idempotencyKey: string;
  readonly selectedClueIds: string[];
  readonly markedSuspicious: boolean;
  readonly correct: boolean;
  readonly answeredAt: Date;
}

export interface SavedPhishingAnswer {
  readonly answer: PhishingAnswerRecord;
  readonly replayed: boolean;
  readonly answeredCount: number;
  readonly score: number;
  readonly status: GameSessionStatus;
  readonly completedAt: Date | null;
}

export interface PhishingAnswerContext {
  readonly sessionId: string;
  readonly publicId: string;
  readonly question: PhishingQuestionRecord;
  readonly previousAnswer: PhishingAnswerRecord | null;
}

export interface PhishingRepository {
  startSession(userId: string, now: Date, restart: boolean): Promise<PhishingSessionRecord>;
  findSessionByPublicId(publicId: string, userId: string): Promise<PhishingSessionRecord | null>;
  findAnswerContext(publicId: string, userId: string, questionId: string): Promise<PhishingAnswerContext | null>;
  saveAnswer(input: SavePhishingAnswerData): Promise<SavedPhishingAnswer>;
  abandon(publicId: string, userId: string, now: Date): Promise<boolean>;
}

const questionSelect = {
  id: true,
  senderName: true,
  senderEmail: true,
  senderAsset: true,
  subject: true,
  preview: true,
  greeting: true,
  body: true,
  action: true,
  attachmentName: true,
  attachmentAsset: true,
  suspicious: true,
  explanation: true,
  clues: true,
} as const;

const sessionInclude = {
  sessionQuestions: {
    select: { position: true, question: { select: questionSelect } },
    orderBy: { position: 'asc' as const },
  },
  answers: {
    select: {
      idempotencyKey: true,
      questionId: true,
      selectedClueIds: true,
      markedSuspicious: true,
      correct: true,
      answeredAt: true,
    },
    orderBy: { answeredAt: 'asc' as const },
  },
} as const;

function createPublicId(): string {
  const token = randomBytes(8).toString('hex').toUpperCase();
  return `PH-${token.slice(0, 6)}-${token.slice(6, 12)}-${token.slice(12, 16)}`;
}

function shuffled<T>(items: readonly T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    const current = result[index];
    const replacement = result[target];
    if (current === undefined || replacement === undefined) continue;
    result[index] = replacement;
    result[target] = current;
  }
  return result;
}

export class PrismaPhishingRepository implements PhishingRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public startSession(userId: string, now: Date, restart: boolean): Promise<PhishingSessionRecord> {
    return this.prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`phishing-start:${userId}`}))`;
      const active = await transaction.trPhishingSession.findFirst({
        where: { userId, status: 'ACTIVE' },
        orderBy: { startedAt: 'desc' },
        include: sessionInclude,
      });
      if (active && !restart) return active;
      if (active) {
        await transaction.trPhishingSession.updateMany({
          where: { userId, status: 'ACTIVE' },
          data: { status: 'ABANDONED', completedAt: now, updatedAt: now },
        });
      }

      const questions = await transaction.msPhishingQuestion.findMany({
        where: { isActive: true },
        select: { id: true },
      });
      const selected = shuffled(questions).slice(0, 15);
      if (selected.length !== 15) throw new Error('Phishing master questions are incomplete.');
      return transaction.trPhishingSession.create({
        data: {
          publicId: createPublicId(),
          userId,
          startedAt: now,
          updatedAt: now,
          sessionQuestions: {
            create: selected.map((question, position) => ({ questionId: question.id, position })),
          },
        },
        include: sessionInclude,
      });
    });
  }

  public findSessionByPublicId(publicId: string, userId: string): Promise<PhishingSessionRecord | null> {
    return this.prisma.trPhishingSession.findFirst({
      where: { publicId, userId, status: { in: ['ACTIVE', 'COMPLETED', 'LOST'] } },
      include: sessionInclude,
    });
  }

  public async findAnswerContext(publicId: string, userId: string, questionId: string): Promise<PhishingAnswerContext | null> {
    const session = await this.prisma.trPhishingSession.findFirst({
      where: { publicId, userId, status: { in: ['ACTIVE', 'COMPLETED', 'LOST'] } },
      select: {
        id: true,
        publicId: true,
        sessionQuestions: {
          where: { questionId },
          select: { question: { select: questionSelect } },
          take: 1,
        },
        answers: {
          where: { questionId },
          select: {
            idempotencyKey: true,
            questionId: true,
            selectedClueIds: true,
            markedSuspicious: true,
            correct: true,
            answeredAt: true,
          },
          take: 1,
        },
      },
    });
    const question = session?.sessionQuestions[0]?.question;
    if (!session || !question) return null;
    return {
      sessionId: session.id,
      publicId: session.publicId,
      question,
      previousAnswer: session.answers[0] ?? null,
    };
  }

  public saveAnswer(input: SavePhishingAnswerData): Promise<SavedPhishingAnswer> {
    return this.prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`phishing-answer:${input.sessionId}`}))`;
      const existing = await transaction.trPhishingAnswer.findUnique({
        where: { userId_idempotencyKey: { userId: input.userId, idempotencyKey: input.idempotencyKey } },
      });
      if (existing) {
        if (existing.sessionId !== input.sessionId || existing.questionId !== input.questionId || existing.markedSuspicious !== input.markedSuspicious || existing.selectedClueIds.join(',') !== input.selectedClueIds.join(',')) {
          throw new Error('Idempotency key payload mismatch.');
        }
        const session = await transaction.trPhishingSession.findUniqueOrThrow({ where: { id: input.sessionId } });
        return {
          answer: existing,
          replayed: true,
          answeredCount: session.answeredCount,
          score: session.score,
          status: session.status,
          completedAt: session.completedAt,
        };
      }

      const activeSession = await transaction.trPhishingSession.findFirst({
        where: { id: input.sessionId, userId: input.userId, status: 'ACTIVE' },
      });
      if (!activeSession) throw new Error('Phishing session is not active.');
      const answer = await transaction.trPhishingAnswer.create({ data: input });
      const answeredCount = activeSession.answeredCount + 1;
      const score = activeSession.score + Number(input.correct);
      const mistakes = answeredCount - score;
      const status: GameSessionStatus = mistakes >= 3 ? 'LOST' : answeredCount >= 15 ? 'COMPLETED' : 'ACTIVE';
      const terminal = status !== 'ACTIVE';
      const session = await transaction.trPhishingSession.update({
        where: { id: input.sessionId },
        data: {
          answeredCount,
          score,
          status,
          completedAt: terminal ? input.answeredAt : null,
          updatedAt: input.answeredAt,
        },
      });
      if (terminal) {
        await transaction.gameProgress.upsert({
          where: {
            userId_idempotencyKey: {
              userId: input.userId,
              idempotencyKey: `phishing-session:${activeSession.publicId}`,
            },
          },
          create: {
            userId: input.userId,
            idempotencyKey: `phishing-session:${activeSession.publicId}`,
            mode: 'PHISHING',
            score,
            maxScore: 15,
            mistakes,
            durationMs: Math.max(1, Math.min(86_400_000, input.answeredAt.getTime() - activeSession.startedAt.getTime())),
            completedAt: input.answeredAt,
          },
          update: {},
        });
      }
      return {
        answer,
        replayed: false,
        answeredCount,
        score,
        status: session.status,
        completedAt: session.completedAt,
      };
    });
  }

  public async abandon(publicId: string, userId: string, now: Date): Promise<boolean> {
    const result = await this.prisma.trPhishingSession.updateMany({
      where: { publicId, userId, status: 'ACTIVE' },
      data: { status: 'ABANDONED', completedAt: now, updatedAt: now },
    });
    return result.count > 0;
  }
}
