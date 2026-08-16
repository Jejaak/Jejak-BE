import { EventEmitter } from 'node:events';

interface PhishingAnswerPayload {
  readonly type: 'phishing.answer.saved' | 'phishing.session.completed' | 'phishing.session.lost';
  readonly sessionId: string;
  readonly questionId: string;
  readonly selectedClueIds: string[];
  readonly markedSuspicious: boolean;
  readonly correct: boolean;
  readonly answeredCount: number;
  readonly score: number;
  readonly mistakes: number;
  readonly status: 'ACTIVE' | 'COMPLETED' | 'LOST';
  readonly suspicious: boolean;
  readonly explanation: string;
  readonly clues: ReadonlyArray<{
    readonly id: 'sender' | 'subject' | 'body' | 'action' | 'attachment';
    readonly label: string;
    readonly text: string;
  }>;
}

interface PhishingAbandonedPayload {
  readonly type: 'phishing.session.abandoned';
  readonly sessionId: string;
  readonly status: 'ABANDONED';
}

export type PhishingRealtimePayload = PhishingAnswerPayload | PhishingAbandonedPayload;

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
