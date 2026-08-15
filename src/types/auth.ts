export interface AuthSession {
  readonly session: {
    readonly id: string;
    readonly expiresAt: Date;
  };
  readonly user: {
    readonly id: string;
    readonly email: string;
    readonly name: string;
  };
}

export interface AuthSessionProvider {
  readonly api: {
    getSession(input: { headers: Headers }): Promise<AuthSession | null>;
  };
}
