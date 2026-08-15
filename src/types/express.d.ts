declare global {
  namespace Express {
    interface Request {
      requestId: string;
      authContext?: {
        readonly userId: string;
        readonly sessionId: string;
      };
    }
  }
}

export {};
