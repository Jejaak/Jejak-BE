import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import type { Env } from '../config/env.js';
import type { PrismaClient } from '../generated/prisma/client.js';

export function createAuth(prisma: PrismaClient, env: Env) {
  return betterAuth({
    appName: 'Jejak',
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [env.FRONTEND_ORIGIN],
    database: prismaAdapter(prisma, {
      provider: 'postgresql',
      transaction: true,
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
    },
    session: {
      expiresIn: 7 * 24 * 60 * 60,
      updateAge: 24 * 60 * 60,
    },
    advanced: {
      useSecureCookies: env.NODE_ENV === 'production',
      defaultCookieAttributes: {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
        path: '/',
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
