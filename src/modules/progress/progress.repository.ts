import type { PrismaClient } from '../../generated/prisma/client.js';
import type { GameMode } from './progress.validation.js';

export interface GameProgressRecord {
  readonly id: string;
  readonly userId: string;
  readonly idempotencyKey: string;
  readonly mode: GameMode;
  readonly score: number;
  readonly maxScore: number;
  readonly mistakes: number;
  readonly durationMs: number;
  readonly completedAt: Date;
}

export type CreateProgressData = Omit<GameProgressRecord, 'id'>;

export interface ModeAggregate {
  readonly mode: GameMode;
  readonly bestScore: number;
  readonly lastPlayedAt: Date;
}

export interface ProgressOverview {
  readonly modeAggregates: ModeAggregate[];
  readonly recentHistory: GameProgressRecord[];
}

export interface ProgressRepository {
  getOverviewByUserId(userId: string, historyLimit: number): Promise<ProgressOverview>;
  save(input: CreateProgressData): Promise<GameProgressRecord>;
}

const progressSelect = {
  id: true,
  userId: true,
  idempotencyKey: true,
  mode: true,
  score: true,
  maxScore: true,
  mistakes: true,
  durationMs: true,
  completedAt: true,
} as const;

export class PrismaProgressRepository implements ProgressRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public async getOverviewByUserId(userId: string, historyLimit: number): Promise<ProgressOverview> {
    const [aggregates, recentHistory] = await Promise.all([
      this.prisma.gameProgress.groupBy({
        by: ['mode'],
        where: { userId },
        _max: { score: true, completedAt: true },
      }),
      this.prisma.gameProgress.findMany({
        where: { userId },
        select: progressSelect,
        orderBy: { completedAt: 'desc' },
        take: historyLimit,
      }),
    ]);
    return {
      modeAggregates: aggregates.flatMap((aggregate) =>
        aggregate._max.score === null || aggregate._max.completedAt === null
          ? []
          : [
              {
                mode: aggregate.mode,
                bestScore: aggregate._max.score,
                lastPlayedAt: aggregate._max.completedAt,
              },
            ],
      ),
      recentHistory,
    };
  }

  public save(input: CreateProgressData): Promise<GameProgressRecord> {
    return this.prisma.gameProgress.upsert({
      where: {
        userId_idempotencyKey: {
          userId: input.userId,
          idempotencyKey: input.idempotencyKey,
        },
      },
      create: input,
      update: {},
      select: progressSelect,
    });
  }
}
