import type {
  CreateProgressData,
  GameProgressRecord,
  ModeAggregate,
  ProgressRepository,
} from './progress.repository.js';
import { gameModes, type GameMode } from './progress.validation.js';

const RECENT_HISTORY_LIMIT = 10;

interface GameSummary {
  readonly gameType: GameMode;
  readonly status: 'NOT_STARTED' | 'COMPLETED';
  readonly bestScore: number | null;
  readonly lastPlayedAt: Date | null;
}

function summarizeMode(mode: GameMode, aggregate: ModeAggregate | undefined): GameSummary {
  return {
    gameType: mode,
    status: aggregate ? 'COMPLETED' : 'NOT_STARTED',
    bestScore: aggregate?.bestScore ?? null,
    lastPlayedAt: aggregate?.lastPlayedAt ?? null,
  };
}

function publicRecord(record: GameProgressRecord) {
  return {
    id: record.id,
    mode: record.mode,
    score: record.score,
    maxScore: record.maxScore,
    mistakes: record.mistakes,
    durationMs: record.durationMs,
    completedAt: record.completedAt,
  };
}

export class ProgressService {
  public constructor(private readonly repository: ProgressRepository) {}

  public async list(userId: string) {
    const overview = await this.repository.getOverviewByUserId(userId, RECENT_HISTORY_LIMIT);
    const aggregates = new Map(overview.modeAggregates.map((item) => [item.mode, item]));
    const games = gameModes.map((mode) => summarizeMode(mode, aggregates.get(mode)));
    return {
      completedGames: games.filter((game) => game.status === 'COMPLETED').length,
      totalGames: gameModes.length,
      games,
      recentHistory: overview.recentHistory.slice(0, RECENT_HISTORY_LIMIT).map(publicRecord),
    };
  }

  public async save(input: CreateProgressData) {
    return publicRecord(await this.repository.save(input));
  }
}
