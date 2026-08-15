import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { frontendOrigins, type Env } from '../config/env.js';
import type { PrismaClient } from '../generated/prisma/client.js';

export function createAuth(prisma: PrismaClient, env: Env) {
  const secure = new URL(env.BETTER_AUTH_URL).protocol === 'https:';
  return betterAuth({
    appName: 'Jejak',
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [...frontendOrigins(env)],
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
      useSecureCookies: secure,
      trustedProxyHeaders: env.TRUST_PROXY_HOPS > 0,
      defaultCookieAttributes: {
        httpOnly: true,
        secure,
        sameSite: secure ? 'none' : 'lax',
        path: '/',
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
