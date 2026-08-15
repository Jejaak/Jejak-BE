import { z } from 'zod';

const PLACEHOLDER_SECRET = 'replace-with-at-least-32-random-characters';

const originSchema = z.url().transform((value, context) => {
  const url = new URL(value);
  if (url.pathname !== '/' || url.search || url.hash || url.username || url.password) {
    context.addIssue({
      code: 'custom',
      message: 'URL must be an exact origin',
    });
    return z.NEVER;
  }
  return url.origin;
});

const rawEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().min(1).default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(3).default(0),
  DATABASE_URL: z
    .url()
    .refine((value) => /^postgres(?:ql)?:\/\//u.test(value), 'DATABASE_URL must be PostgreSQL'),
  DB_POOL_MAX: z.coerce.number().int().min(1).max(50).default(10),
  DB_POOL_CONNECTION_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(60_000).default(10_000),
  DB_POOL_IDLE_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(300_000).default(30_000),
  DB_TRANSACTION_MAX_WAIT_MS: z.coerce.number().int().min(1_000).max(60_000).default(10_000),
  DB_TRANSACTION_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(120_000).default(15_000),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: originSchema.default('http://localhost:3000'),
  FRONTEND_ORIGIN: originSchema.default('http://localhost:5173'),
  FRONTEND_ORIGINS: z.string().optional(),
  JSON_BODY_LIMIT: z.string().regex(/^\d+(?:b|kb|mb)$/iu).default('16kb'),
  API_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
  API_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
  AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
});

export type Env = Readonly<z.infer<typeof rawEnvSchema>>;

export function frontendOrigins(env: Pick<Env, 'FRONTEND_ORIGIN' | 'FRONTEND_ORIGINS'>): readonly string[] {
  const configured = env.FRONTEND_ORIGINS?.split(',').map((value) => value.trim()).filter(Boolean) ?? [];
  const origins = [env.FRONTEND_ORIGIN, ...configured].map((value) => originSchema.parse(value));
  return [...new Set(origins)];
}

export function byteSize(value: string): number {
  const match = /^(\d+)(b|kb|mb)$/iu.exec(value);
  if (!match) throw new Error('Invalid byte size');
  const amount = Number(match[1]);
  const unit = match[2]?.toLowerCase();
  return amount * (unit === 'mb' ? 1_048_576 : unit === 'kb' ? 1_024 : 1);
}

export function parseEnv(source: NodeJS.ProcessEnv | Record<string, string>): Env {
  const parsed = rawEnvSchema.parse(source);
  if (parsed.NODE_ENV === 'production') {
    if (new URL(parsed.BETTER_AUTH_URL).protocol !== 'https:') {
      throw new Error('BETTER_AUTH_URL must use HTTPS in production');
    }
    if (frontendOrigins(parsed).some((origin) => new URL(origin).protocol !== 'https:')) {
      throw new Error('All frontend origins must use HTTPS in production');
    }
    if (parsed.BETTER_AUTH_SECRET === PLACEHOLDER_SECRET) {
      throw new Error('BETTER_AUTH_SECRET must not use the documented placeholder in production');
    }
  }
  return Object.freeze(parsed);
}
