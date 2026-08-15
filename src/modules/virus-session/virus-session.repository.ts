import { randomBytes } from 'node:crypto';
import type { PrismaClient, VirusFileAction, VirusSessionStatus } from '../../generated/prisma/client.js';

export interface VirusSessionFileRecord {
  readonly id: string;
  readonly fileId: string;
  readonly position: number;
  readonly action: VirusFileAction | null;
  readonly correct: boolean | null;
  readonly file: {
    readonly id: string;
    readonly name: string;
    readonly suspicious: boolean;
    readonly asset: string;
  };
}

export interface VirusSessionRecord {
  readonly id: string;
  readonly publicId: string;
  readonly userId: string;
  readonly status: VirusSessionStatus;
  readonly safeCount: number;
  readonly mistakes: number;
  readonly startedAt: Date;
  readonly completedAt: Date | null;
  readonly sessionFiles: VirusSessionFileRecord[];
}

export interface VirusSessionRepository {
  abandonActive(userId: string, completedAt: Date): Promise<void>;
  create(userId: string): Promise<VirusSessionRecord>;
  findActiveByPublicId(publicId: string, userId: string): Promise<VirusSessionRecord | null>;
  findById(sessionId: string, userId: string): Promise<VirusSessionRecord | null>;
  abandon(sessionId: string, userId: string, completedAt: Date): Promise<boolean>;
  resolveFile(input: {
    sessionId: string;
    sessionFileId: string;
    action: VirusFileAction;
    correct: boolean;
    safeCount: number;
    mistakes: number;
    status: VirusSessionStatus;
    completedAt: Date | null;
  }): Promise<VirusSessionRecord>;
}

const sessionInclude = {
  sessionFiles: {
    include: { file: true },
    orderBy: { position: 'asc' as const },
  },
} as const;

function createPublicId(): string {
  const token = randomBytes(8).toString('hex').toUpperCase();
  return `VRS-${token.slice(0, 6)}-${token.slice(6, 12)}-${token.slice(12, 16)}`;
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

export class PrismaVirusSessionRepository implements VirusSessionRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public async abandonActive(userId: string, completedAt: Date): Promise<void> {
    await this.prisma.trVirusSession.updateMany({
      where: { userId, status: 'ACTIVE' },
      data: { status: 'ABANDONED', completedAt, updatedAt: completedAt },
    });
  }

  public async create(userId: string): Promise<VirusSessionRecord> {
    const files = await this.prisma.msVirusFile.findMany({ where: { isActive: true } });
    const selected = shuffled([
      ...shuffled(files.filter((file) => !file.suspicious)).slice(0, 20),
      ...shuffled(files.filter((file) => file.suspicious)).slice(0, 20),
    ]);
    if (selected.length !== 40) throw new Error('Virus master files are incomplete.');

    return this.prisma.trVirusSession.create({
      data: {
        publicId: createPublicId(),
        userId,
        sessionFiles: {
          create: selected.map((file, position) => ({ fileId: file.id, position })),
        },
      },
      include: sessionInclude,
    });
  }

  public findActiveByPublicId(publicId: string, userId: string): Promise<VirusSessionRecord | null> {
    return this.prisma.trVirusSession.findFirst({
      where: { publicId, userId, status: 'ACTIVE' },
      include: sessionInclude,
    });
  }

  public findById(sessionId: string, userId: string): Promise<VirusSessionRecord | null> {
    return this.prisma.trVirusSession.findFirst({
      where: { id: sessionId, userId },
      include: sessionInclude,
    });
  }

  public async abandon(sessionId: string, userId: string, completedAt: Date): Promise<boolean> {
    const result = await this.prisma.trVirusSession.updateMany({
      where: { id: sessionId, userId, status: 'ACTIVE' },
      data: { status: 'ABANDONED', completedAt, updatedAt: completedAt },
    });
    return result.count === 1;
  }

  public resolveFile(input: {
    sessionId: string;
    sessionFileId: string;
    action: VirusFileAction;
    correct: boolean;
    safeCount: number;
    mistakes: number;
    status: VirusSessionStatus;
    completedAt: Date | null;
  }): Promise<VirusSessionRecord> {
    return this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.trVirusSessionFile.updateMany({
        where: { id: input.sessionFileId, sessionId: input.sessionId, action: null },
        data: { action: input.action, correct: input.correct, resolvedAt: new Date() },
      });
      if (updated.count !== 1) throw new Error('Virus file has already been resolved.');
      return transaction.trVirusSession.update({
        where: { id: input.sessionId },
        data: {
          safeCount: input.safeCount,
          mistakes: input.mistakes,
          status: input.status,
          completedAt: input.completedAt,
        },
        include: sessionInclude,
      });
    });
  }
}
