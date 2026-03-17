import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import type { AppContext, AuthUser } from "../env";
import { createUsersDb, apiTokens, users } from "../db";
import { eq, isNull, and } from "drizzle-orm";
import { createAuth } from "../lib/auth";
import { drizzle } from "drizzle-orm/d1";

// Hash token for KV key (tokens can be 1000+ chars, KV limit is 512)
async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const authMiddleware = createMiddleware<AppContext>(async (c, next) => {
  const authHeader = c.req.header("Authorization");

  // Better Auth sessions use cookies — no Authorization header needed
  // But API tokens still use Bearer auth
  if (!authHeader) {
    // Try cookie-based Better Auth session
    const auth = createAuth(drizzle(c.env.USERS_DB), {
      BETTER_AUTH_SECRET: c.env.BETTER_AUTH_SECRET,
      BETTER_AUTH_URL: c.env.BETTER_AUTH_URL,
      GOOGLE_CLIENT_ID: c.env.GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET: c.env.GOOGLE_CLIENT_SECRET,
    });

    const session = await auth.api.getSession({
      headers: c.req.raw.headers,
    });

    if (!session) {
      throw new HTTPException(401, { message: "Missing authorization" });
    }

    const userRecord = await createUsersDb(c.env.USERS_DB)
      .select({ roles: users.roles })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    const roles = userRecord[0]?.roles
      ? JSON.parse(userRecord[0].roles)
      : ["user"];

    c.set("user", {
      id: session.user.id,
      email: session.user.email,
      roles,
    });
    return next();
  }

  const token = authHeader.replace("Bearer ", "");
  const tokenHash = await hashToken(token);

  // Check KV cache first
  const cached = await c.env.KV.get(`token:${tokenHash}`, "json");
  if (cached) {
    c.set("user", cached as AuthUser);
    return next();
  }

  let user: AuthUser | null = null;

  if (token.startsWith("sk-mira-")) {
    // API Token - lookup in D1
    const usersDb = createUsersDb(c.env.USERS_DB);
    const result = await usersDb
      .select()
      .from(apiTokens)
      .where(and(eq(apiTokens.token, token), isNull(apiTokens.deletedAt)))
      .limit(1);

    if (result.length === 0) {
      throw new HTTPException(401, { message: "Invalid API token" });
    }

    const tokenRecord = result[0];
    if (!tokenRecord) {
      throw new HTTPException(401, { message: "Invalid API token" });
    }

    // Fetch roles from D1
    const userRecord = await usersDb
      .select({ roles: users.roles })
      .from(users)
      .where(eq(users.id, tokenRecord.userId))
      .limit(1);

    const roles = userRecord[0]?.roles
      ? JSON.parse(userRecord[0].roles)
      : ["user"];

    user = {
      id: tokenRecord.userId,
      email: "",
      roles,
    };
  } else {
    // Better Auth session token via Bearer header
    const auth = createAuth(drizzle(c.env.USERS_DB), {
      BETTER_AUTH_SECRET: c.env.BETTER_AUTH_SECRET,
      BETTER_AUTH_URL: c.env.BETTER_AUTH_URL,
      GOOGLE_CLIENT_ID: c.env.GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET: c.env.GOOGLE_CLIENT_SECRET,
    });

    const session = await auth.api.getSession({
      headers: c.req.raw.headers,
    });

    if (!session) {
      throw new HTTPException(401, { message: "Invalid session token" });
    }

    const usersDb = createUsersDb(c.env.USERS_DB);
    const userRecord = await usersDb
      .select({ roles: users.roles })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    const roles = userRecord[0]?.roles
      ? JSON.parse(userRecord[0].roles)
      : ["user"];

    user = {
      id: session.user.id,
      email: session.user.email,
      roles,
    };
  }

  // Cache in KV for 1 hour
  await c.env.KV.put(`token:${tokenHash}`, JSON.stringify(user), {
    expirationTtl: 3600,
  });

  c.set("user", user);
  return next();
});

export const requireAdmin = createMiddleware<AppContext>(async (c, next) => {
  const user = c.get("user");

  if (!user || !user.roles.includes("admin")) {
    throw new HTTPException(403, { message: "Admin access required" });
  }

  return next();
});
