import { EventEmitter } from 'node:events';

export interface PhishingRealtimePayload {
  readonly type: 'phishing.answer.saved' | 'phishing.session.completed';
  readonly sessionId: string;
  readonly questionId: string;
  readonly selectedClueIds: string[];
  readonly markedSuspicious: boolean;
  readonly correct: boolean;
  readonly answeredCount: number;
  readonly score: number;
  readonly mistakes: number;
  readonly status: 'ACTIVE' | 'COMPLETED' | 'ABANDONED';
  readonly suspicious: boolean;
  readonly explanation: string;
  readonly clues: ReadonlyArray<{
    readonly id: 'sender' | 'subject' | 'body' | 'action' | 'attachment';
    readonly label: string;
    readonly text: string;
  }>;
}

interface PhishingRealtimeEnvelope {
  readonly publicId: string;
  readonly userId: string;
  readonly payload: PhishingRealtimePayload;
}

export class PhishingEvents {
  private readonly emitter = new EventEmitter();

  public publish(event: PhishingRealtimeEnvelope): void {
    this.emitter.emit('session', event);
  }

  public subscribe(listener: (event: PhishingRealtimeEnvelope) => void): () => void {
    this.emitter.on('session', listener);
    return () => this.emitter.off('session', listener);
  }
}
