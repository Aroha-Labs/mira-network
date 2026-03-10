import { Hono } from "hono";
import type { AppContext } from "../env";
import { authMiddleware } from "../middleware/auth";
import { createBillingDb, createUsersDb, creditHistory, users } from "../db";
import { eq, desc, count } from "drizzle-orm";
import { getUserCredits } from "../lib/credits";

export const creditsRoutes = new Hono<AppContext>();

creditsRoutes.use("*", authMiddleware);

// GET /me - get current user info
creditsRoutes.get("/me", async (c) => {
  const authUser = c.get("user")!;

  const usersDb = createUsersDb(c.env.USERS_DB);
  const result = await usersDb.select().from(users).where(eq(users.id, authUser.id)).limit(1);

  if (result.length === 0) {
    return c.json({ detail: "User not found" }, 404);
  }

  const user = result[0]!;
  const credits = await getUserCredits(c.env, user.id);

  return c.json({
    id: user.id,
    user_id: user.id,
    email: user.email,
    full_name: user.fullName || "",
    avatar_url: user.avatarUrl,
    provider: user.provider || "",
    credits,
    roles: JSON.parse(user.roles || '["user"]'),
    created_at: user.createdAt,
    updated_at: user.updatedAt,
  });
});

// GET /user-credits - get current balance
creditsRoutes.get("/user-credits", async (c) => {
  const user = c.get("user")!;
  const credits = await getUserCredits(c.env, user.id);
  return c.json({ credits });
});

// GET /user-credits-history - matches existing paginated response
creditsRoutes.get("/user-credits-history", async (c) => {
  const user = c.get("user")!;
  const page = parseInt(c.req.query("page") || "1");
  const size = parseInt(c.req.query("size") || "20");

  const billingDb = createBillingDb(c.env.BILLING_DB);

  // Get total count
  const countResult = await billingDb
    .select({ count: count() })
    .from(creditHistory)
    .where(eq(creditHistory.userId, user.id));

  const total = countResult[0]?.count || 0;
  const totalPages = Math.ceil(total / size);

  // Get paginated history
  const history = await billingDb
    .select()
    .from(creditHistory)
    .where(eq(creditHistory.userId, user.id))
    .orderBy(desc(creditHistory.createdAt))
    .limit(size)
    .offset((page - 1) * size);

  return c.json({
    items: history.map((h) => ({
      id: h.id,
      user_id: h.userId,
      amount: h.amount,
      description: h.description,
      created_at: h.createdAt,
    })),
    total,
    page,
    size,
    pages: totalPages,
  });
});
