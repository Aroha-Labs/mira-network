import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import type { AppContext } from "../env";
import { authMiddleware } from "../middleware/auth";
import { createUsersDb, apiTokens } from "../db";
import { eq, and, isNull, count } from "drizzle-orm";
import { createApiTokenRequestSchema, paginationQuerySchema } from "../schemas";

export const tokensRoutes = new Hono<AppContext>();

tokensRoutes.use("*", authMiddleware);

// POST /api-tokens - matches existing response
tokensRoutes.post("/", zValidator("json", createApiTokenRequestSchema), async (c) => {
  const user = c.get("user")!;
  const { description, meta_data } = c.req.valid("json");

  const usersDb = createUsersDb(c.env.USERS_DB);

  // Generate token: sk-mira- + 24 random bytes as hex
  const randomBytes = new Uint8Array(24);
  crypto.getRandomValues(randomBytes);
  const token = `sk-mira-${Array.from(randomBytes).map((b) => b.toString(16).padStart(2, "0")).join("")}`;

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await usersDb.insert(apiTokens).values({
    id,
    userId: user.id,
    token,
    description: description || null,
    metaData: meta_data ? JSON.stringify(meta_data) : null,
    createdAt: now,
  });

  return c.json({
    id,
    token,
    description: description || null,
    meta_data: meta_data || {},
    created_at: now,
  });
});

// GET /api-tokens - matches existing paginated response
tokensRoutes.get("/", zValidator("query", paginationQuerySchema), async (c) => {
  const user = c.get("user")!;
  const query = c.req.valid("query");
  const page = query.page ?? 1;
  const pageSize = query.page_size ?? 10;

  const usersDb = createUsersDb(c.env.USERS_DB);

  // Get total count
  const countResult = await usersDb
    .select({ count: count() })
    .from(apiTokens)
    .where(and(eq(apiTokens.userId, user.id), isNull(apiTokens.deletedAt)));

  const total = countResult[0]?.count || 0;
  const totalPages = Math.ceil(total / pageSize);

  // Get paginated tokens
  const tokens = await usersDb
    .select()
    .from(apiTokens)
    .where(and(eq(apiTokens.userId, user.id), isNull(apiTokens.deletedAt)))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return c.json({
    items: tokens.map((t) => ({
      id: t.id,
      token: t.token,
      description: t.description,
      meta_data: t.metaData ? JSON.parse(t.metaData) : {},
      created_at: t.createdAt,
    })),
    total,
    page,
    page_size: pageSize,
    total_pages: totalPages,
  });
});

// DELETE /api-tokens/:token - matches existing response
tokensRoutes.delete("/:token", async (c) => {
  const user = c.get("user")!;
  const token = c.req.param("token");

  const usersDb = createUsersDb(c.env.USERS_DB);

  const existing = await usersDb
    .select()
    .from(apiTokens)
    .where(and(eq(apiTokens.token, token), eq(apiTokens.userId, user.id)))
    .limit(1);

  if (existing.length === 0) {
    return c.json({ detail: "Token not found" }, 404);
  }

  // Soft delete
  await usersDb
    .update(apiTokens)
    .set({ deletedAt: new Date().toISOString() })
    .where(eq(apiTokens.token, token));

  // Invalidate cache
  await c.env.KV.delete(`token:${token}`);

  return c.json({ message: "Token deleted successfully" });
});
