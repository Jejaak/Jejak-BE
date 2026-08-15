import type { VirusFileAction, VirusSessionStatus } from '../../generated/prisma/client.js';
import type { VirusSessionRecord, VirusSessionRepository } from './virus-session.repository.js';

const safeTarget = 15;
const maxMistakes = 3;

function publicSession(session: VirusSessionRecord) {
  return {
    id: session.id,
    publicId: session.publicId,
    status: session.status,
    safeCount: session.safeCount,
    mistakes: session.mistakes,
    startedAt: session.startedAt,
    completedAt: session.completedAt,
    files: session.sessionFiles.map((item) => ({
      id: item.file.id,
      name: item.file.name,
      asset: item.file.asset,
      suspicious: item.file.suspicious,
      position: item.position,
      resolved: item.action !== null,
    })),
  };
}

export class VirusSessionService {
  public constructor(private readonly repository: VirusSessionRepository) {}

  public async start(userId: string, now: Date) {
    await this.repository.abandonActive(userId, now);
    return publicSession(await this.repository.create(userId));
  }

  public async getActive(userId: string, publicId: string) {
    const session = await this.repository.findActiveByPublicId(publicId, userId);
    return session ? publicSession(session) : null;
  }

  public abandon(userId: string, sessionId: string, now: Date): Promise<boolean> {
    return this.repository.abandon(sessionId, userId, now);
  }

  public async act(userId: string, sessionId: string, fileId: string, action: VirusFileAction, now: Date) {
    const session = await this.repository.findById(sessionId, userId);
    if (!session || session.status !== 'ACTIVE') return null;
    const item = session.sessionFiles.find((candidate) => candidate.fileId === fileId && candidate.action === null);
    if (!item) return null;

    const correct = action === (item.file.suspicious ? 'BLOCK' : 'ALLOW');
    const safeCount = session.safeCount + (correct && !item.file.suspicious ? 1 : 0);
    const mistakes = session.mistakes + (correct ? 0 : 1);
    const status: VirusSessionStatus = mistakes >= maxMistakes ? 'LOST' : safeCount >= safeTarget ? 'WON' : 'ACTIVE';
    const updated = await this.repository.resolveFile({
      sessionId,
      sessionFileId: item.id,
      action,
      correct,
      safeCount,
      mistakes,
      status,
      completedAt: status === 'ACTIVE' ? null : now,
    });
    return { session: publicSession(updated), correct, fileName: item.file.name };
  }
}
