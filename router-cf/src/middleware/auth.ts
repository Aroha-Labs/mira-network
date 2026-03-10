import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { createClient } from "@supabase/supabase-js";
import type { AppContext, AuthUser } from "../env";
import { createUsersDb, apiTokens, users } from "../db";
import { eq, isNull, and } from "drizzle-orm";

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

  if (!authHeader) {
    throw new HTTPException(401, { message: "Missing authorization header" });
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
    // Supabase JWT
    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_KEY);
    const {
      data: { user: supabaseUser },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !supabaseUser) {
      throw new HTTPException(401, { message: "Invalid JWT token" });
    }

    // Fetch roles from D1 (our source of truth for roles)
    const usersDb = createUsersDb(c.env.USERS_DB);
    const userRecord = await usersDb
      .select({ roles: users.roles })
      .from(users)
      .where(eq(users.id, supabaseUser.id))
      .limit(1);

    const roles = userRecord[0]?.roles
      ? JSON.parse(userRecord[0].roles)
      : ["user"];

    user = {
      id: supabaseUser.id,
      email: supabaseUser.email || "",
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
