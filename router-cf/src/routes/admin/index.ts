import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import type { AppContext } from "../../env";
import { authMiddleware, requireAdmin } from "../../middleware/auth";
import { createUsersDb, createAppDb, createBillingDb, users, settings, creditHistory } from "../../db";
import { eq, like, sql, desc, and, gte, lte } from "drizzle-orm";
import {
  addCreditRequestSchema,
  updateUserClaimsRequestSchema,
  updateSettingRequestSchema,
  usersQuerySchema,
} from "../../schemas";

export const adminRoutes = new Hono<AppContext>();

adminRoutes.use("*", authMiddleware);
adminRoutes.use("*", requireAdmin);

// GET /admin/users - paginated user list
adminRoutes.get("/users", zValidator("query", usersQuerySchema), async (c) => {
  const query = c.req.valid("query");
  const page = query.page ?? 1;
  const pageSize = query.page_size ?? 10;
  const { search, sort_by, sort_order, min_credits, max_credits } = query;

  const usersDb = createUsersDb(c.env.USERS_DB);

  const conditions = [];

  if (search) {
    conditions.push(like(users.email, `%${search}%`));
  }

  // Get paginated users
  let usersQuery = usersDb.select().from(users);

  if (conditions.length > 0) {
    usersQuery = usersQuery.where(and(...conditions)) as typeof usersQuery;
  }

  const usersList = await usersQuery.limit(pageSize).offset((page - 1) * pageSize);

  // Get total count
  let countQuery = usersDb.select({ count: sql<number>`count(*)` }).from(users);
  if (conditions.length > 0) {
    countQuery = countQuery.where(and(...conditions)) as typeof countQuery;
  }
  const countResult = await countQuery;

  const total = countResult[0]?.count || 0;

  // Get credits for each user from KV
  const usersWithCredits = await Promise.all(
    usersList.map(async (user) => {
      const creditsStr = await c.env.KV.get(`credits:${user.id}`);
      const credits = creditsStr ? parseFloat(creditsStr) : 0;

      // Filter by credits if specified
      if (min_credits !== undefined && credits < min_credits) return null;
      if (max_credits !== undefined && credits > max_credits) return null;

      return {
        id: user.id,
        email: user.email,
        full_name: user.fullName,
        avatar_url: user.avatarUrl,
        provider: user.provider,
        roles: JSON.parse(user.roles || '["user"]'),
        credits,
        created_at: user.createdAt,
        updated_at: user.updatedAt,
      };
    })
  );

  const filteredUsers = usersWithCredits.filter((u) => u !== null);

  return c.json({
    items: filteredUsers,
    total,
    page,
    page_size: pageSize,
    total_pages: Math.ceil(total / pageSize),
  });
});

// POST /admin/add-credit
adminRoutes.post("/add-credit", zValidator("json", addCreditRequestSchema), async (c) => {
  const { user_id, amount, description } = c.req.valid("json");

  // Update credits in KV
  const currentCreditsStr = await c.env.KV.get(`credits:${user_id}`);
  const currentCredits = currentCreditsStr ? parseFloat(currentCreditsStr) : 0;
  const newCredits = currentCredits + amount;

  await c.env.KV.put(`credits:${user_id}`, newCredits.toString());

  // Log to billing DB
  const billingDb = createBillingDb(c.env.BILLING_DB);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await billingDb.insert(creditHistory).values({
    id,
    userId: user_id,
    amount,
    description: description || `Admin credit adjustment`,
    createdAt: now,
  });

  return c.json({
    user_id,
    previous_balance: currentCredits,
    new_balance: newCredits,
    amount,
    description,
  });
});

// POST /admin/user-claims/:id - update user roles
adminRoutes.post("/user-claims/:id", zValidator("json", updateUserClaimsRequestSchema), async (c) => {
  const userId = c.req.param("id");
  const { roles } = c.req.valid("json");

  const usersDb = createUsersDb(c.env.USERS_DB);

  // Check user exists
  const existing = await usersDb.select().from(users).where(eq(users.id, userId)).limit(1);

  if (existing.length === 0) {
    return c.json({ detail: "User not found" }, 404);
  }

  await usersDb
    .update(users)
    .set({
      roles: JSON.stringify(roles),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(users.id, userId));

  return c.json({ user_id: userId, roles });
});

// GET /admin/user-claims/:id
adminRoutes.get("/user-claims/:id", async (c) => {
  const userId = c.req.param("id");

  const usersDb = createUsersDb(c.env.USERS_DB);
  const result = await usersDb.select().from(users).where(eq(users.id, userId)).limit(1);

  if (result.length === 0) {
    return c.json({ detail: "User not found" }, 404);
  }

  return c.json({
    user_id: userId,
    roles: JSON.parse(result[0]!.roles || '["user"]'),
  });
});

// GET /admin/settings
adminRoutes.get("/settings", async (c) => {
  const appDb = createAppDb(c.env.APP_DB);
  const allSettings = await appDb.select().from(settings);

  return c.json(
    allSettings.map((s) => ({
      name: s.name,
      value: JSON.parse(s.value),
      description: s.description,
      updated_at: s.updatedAt,
    }))
  );
});

// PUT /admin/settings/:name
adminRoutes.put("/settings/:name", zValidator("json", updateSettingRequestSchema), async (c) => {
  const name = c.req.param("name");
  const { value, description } = c.req.valid("json");

  const appDb = createAppDb(c.env.APP_DB);
  const now = new Date().toISOString();

  // Upsert setting
  const existing = await appDb.select().from(settings).where(eq(settings.name, name)).limit(1);

  if (existing.length === 0) {
    await appDb.insert(settings).values({
      name,
      value: JSON.stringify(value),
      description,
      updatedAt: now,
    });
  } else {
    await appDb
      .update(settings)
      .set({
        value: JSON.stringify(value),
        description: description || existing[0]!.description,
        updatedAt: now,
      })
      .where(eq(settings.name, name));
  }

  return c.json({ name, value, description, updated_at: now });
});

// GET /admin/user-credits/:id
adminRoutes.get("/user-credits/:id", async (c) => {
  const userId = c.req.param("id");

  const creditsStr = await c.env.KV.get(`credits:${userId}`);
  const credits = creditsStr ? parseFloat(creditsStr) : 0;

  return c.json({ user_id: userId, credits });
});
