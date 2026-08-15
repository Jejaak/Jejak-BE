import { PrismaPg } from '@prisma/adapter-pg';
import type { Env } from '../config/env.js';
import { PrismaClient } from '../generated/prisma/client.js';

const globalForPrisma = globalThis as unknown as { jejakPrisma?: PrismaClient };

type PrismaConnectionConfig = Pick<
  Env,
  | 'DATABASE_URL'
  | 'DB_POOL_MAX'
  | 'DB_POOL_CONNECTION_TIMEOUT_MS'
  | 'DB_POOL_IDLE_TIMEOUT_MS'
  | 'DB_TRANSACTION_MAX_WAIT_MS'
  | 'DB_TRANSACTION_TIMEOUT_MS'
>;

export function createPrisma(config: PrismaConnectionConfig): PrismaClient {
  const adapter = new PrismaPg({
    connectionString: config.DATABASE_URL,
    max: config.DB_POOL_MAX,
    connectionTimeoutMillis: config.DB_POOL_CONNECTION_TIMEOUT_MS,
    idleTimeoutMillis: config.DB_POOL_IDLE_TIMEOUT_MS,
  });
  return new PrismaClient({
    adapter,
    transactionOptions: {
      maxWait: config.DB_TRANSACTION_MAX_WAIT_MS,
      timeout: config.DB_TRANSACTION_TIMEOUT_MS,
    },
  });
}

export function getPrisma(config: PrismaConnectionConfig): PrismaClient {
  globalForPrisma.jejakPrisma ??= createPrisma(config);
  return globalForPrisma.jejakPrisma;
}
