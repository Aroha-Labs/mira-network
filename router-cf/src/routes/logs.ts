import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import type { AppContext } from "../env";
import { authMiddleware } from "../middleware/auth";
import { createBillingDb, usageSummary } from "../db";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";
import { logsQuerySchema } from "../schemas";

export const logsRoutes = new Hono<AppContext>();

logsRoutes.use("*", authMiddleware);

// GET /api-logs - returns usage summary from D1
logsRoutes.get("/api-logs", zValidator("query", logsQuerySchema), async (c) => {
  const user = c.get("user")!;
  const query = c.req.valid("query");
  const page = query.page ?? 1;
  const pageSize = query.page_size ?? 10;
  const { start_date, end_date, model, user_id } = query;

  // Only admin can query other users
  const targetUserId = user.roles.includes("admin") && user_id ? user_id : user.id;

  const billingDb = createBillingDb(c.env.BILLING_DB);

  // Build conditions
  const conditions = [eq(usageSummary.userId, targetUserId)];

  if (start_date) {
    conditions.push(gte(usageSummary.date, start_date));
  }
  if (end_date) {
    conditions.push(lte(usageSummary.date, end_date));
  }
  if (model) {
    conditions.push(eq(usageSummary.model, model));
  }

  // Get paginated logs
  const logs = await billingDb
    .select()
    .from(usageSummary)
    .where(and(...conditions))
    .orderBy(desc(usageSummary.date))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  // Get total count
  const countResult = await billingDb
    .select({ count: sql<number>`count(*)` })
    .from(usageSummary)
    .where(and(...conditions));

  const total = countResult[0]?.count || 0;
  const totalPages = Math.ceil(total / pageSize);

  return c.json({
    logs: logs.map((log) => ({
      id: log.id,
      user_id: log.userId,
      date: log.date,
      model: log.model,
      request_count: log.requestCount,
      prompt_tokens: log.promptTokens,
      completion_tokens: log.completionTokens,
      total_cost: log.totalCost,
      avg_response_time: log.avgResponseTime,
      avg_ttft: log.avgTtft,
      created_at: log.createdAt,
    })),
    total,
    page,
    page_size: pageSize,
    pages: totalPages,
  });
});

// GET /total-inference-calls - matches existing response
logsRoutes.get("/total-inference-calls", async (c) => {
  const user = c.get("user")!;
  const billingDb = createBillingDb(c.env.BILLING_DB);

  const result = await billingDb
    .select({ total: sql<number>`coalesce(sum(request_count), 0)` })
    .from(usageSummary)
    .where(eq(usageSummary.userId, user.id));

  return c.json({ total: result[0]?.total || 0 });
});

// GET /api-logs/metrics - aggregated metrics
logsRoutes.get("/api-logs/metrics", zValidator("query", logsQuerySchema), async (c) => {
  const user = c.get("user")!;
  const { start_date, end_date, model, user_id } = c.req.valid("query");

  const targetUserId = user.roles.includes("admin") && user_id ? user_id : user.id;

  const billingDb = createBillingDb(c.env.BILLING_DB);

  const conditions = [eq(usageSummary.userId, targetUserId)];

  if (start_date) {
    conditions.push(gte(usageSummary.date, start_date));
  }
  if (end_date) {
    conditions.push(lte(usageSummary.date, end_date));
  }
  if (model) {
    conditions.push(eq(usageSummary.model, model));
  }

  // Aggregate metrics
  const metrics = await billingDb
    .select({
      totalTokens: sql<number>`coalesce(sum(prompt_tokens + completion_tokens), 0)`,
      promptTokens: sql<number>`coalesce(sum(prompt_tokens), 0)`,
      completionTokens: sql<number>`coalesce(sum(completion_tokens), 0)`,
      avgResponseTime: sql<number>`coalesce(avg(avg_response_time), 0)`,
      avgTtft: sql<number>`coalesce(avg(avg_ttft), 0)`,
      totalCost: sql<number>`coalesce(sum(total_cost), 0)`,
    })
    .from(usageSummary)
    .where(and(...conditions));

  // Model distribution
  const modelDistribution = await billingDb
    .select({
      model: usageSummary.model,
      count: sql<number>`sum(request_count)`,
    })
    .from(usageSummary)
    .where(and(...conditions))
    .groupBy(usageSummary.model);

  const m = metrics[0];

  return c.json({
    total_tokens: m?.totalTokens || 0,
    prompt_tokens: m?.promptTokens || 0,
    completion_tokens: m?.completionTokens || 0,
    avg_response_time: m?.avgResponseTime || 0,
    avg_ttft: m?.avgTtft || 0,
    total_cost: m?.totalCost || 0,
    model_distribution: modelDistribution.map((d) => [d.model, d.count]),
  });
});
