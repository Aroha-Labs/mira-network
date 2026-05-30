import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { users, session, account, verification } from "../db/schema/users";

export function createAuth(
  db: DrizzleD1Database,
  env: {
    BETTER_AUTH_SECRET: string;
    BETTER_AUTH_URL: string;
    TRUSTED_ORIGINS?: string;
    GOOGLE_CLIENT_ID: string;
    GOOGLE_CLIENT_SECRET: string;
  }
) {
  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema: { user: users, session, account, verification },
    }),
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    trustedOrigins: env.TRUSTED_ORIGINS
      ? env.TRUSTED_ORIGINS.split(",")
      : ["http://localhost:3000"],
    account: {
      skipStateCookieCheck: true,
    },
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
      },
    },
    user: {
      additionalFields: {
        roles: {
          type: "string",
          defaultValue: '["user"]',
          required: false,
          input: false,
        },
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      updateAge: 60 * 60 * 24, // refresh daily
      cookieCache: {
        enabled: true,
        maxAge: 60 * 5, // 5 minutes
      },
    },
    // Host-only cookies (no Domain attribute) so a single worker can serve
    // multiple frontends on different registrable domains (e.g.
    // console.arohalabs.tech -> console-api.arohalabs.tech and
    // console.mira.network -> api.mira.network). Each frontend is same-site
    // with its own API host, so the SameSite=Lax session cookie is sent.
    // Do NOT re-enable crossSubDomainCookies — pinning a Domain breaks the
    // cross-registrable-domain setup.
    plugins: [admin()],
  });
}

export type Auth = ReturnType<typeof createAuth>;
