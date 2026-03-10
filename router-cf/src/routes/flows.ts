import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import type { AppContext } from "../env";
import { authMiddleware } from "../middleware/auth";
import { createAppDb, flows } from "../db";
import { eq } from "drizzle-orm";
import { createFlowRequestSchema, updateFlowRequestSchema } from "../schemas";

export const flowsRoutes = new Hono<AppContext>();

flowsRoutes.use("*", authMiddleware);

function extractVariables(systemPrompt: string): string[] {
  const matches = systemPrompt.match(/\{\{([^}]+)\}\}/g) || [];
  return matches.map((v) => v.replace(/\{\{|\}\}/g, ""));
}

// GET /flows - matches existing response (returns array)
flowsRoutes.get("/", async (c) => {
  const user = c.get("user")!;
  const appDb = createAppDb(c.env.APP_DB);

  const userFlows = await appDb.select().from(flows).where(eq(flows.userId, user.id));

  // Match existing response - returns array directly
  return c.json(
    userFlows.map((flow) => ({
      id: flow.id,
      name: flow.name,
      system_prompt: flow.systemPrompt,
      variables: JSON.parse(flow.variables || "[]"),
      user_id: flow.userId,
      created_at: flow.createdAt,
      updated_at: flow.updatedAt,
    }))
  );
});

// POST /flows - matches existing response structure
flowsRoutes.post("/", zValidator("json", createFlowRequestSchema), async (c) => {
  const user = c.get("user")!;
  const { name, system_prompt } = c.req.valid("json");

  const variables = extractVariables(system_prompt);
  const appDb = createAppDb(c.env.APP_DB);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await appDb.insert(flows).values({
    id,
    userId: user.id,
    name,
    systemPrompt: system_prompt,
    variables: JSON.stringify(variables),
    createdAt: now,
    updatedAt: now,
  });

  // Match existing response structure
  return c.json({
    id,
    name,
    system_prompt,
    variables,
    user_id: user.id,
    created_at: now,
    updated_at: now,
  });
});

// GET /flows/:id - matches existing response
flowsRoutes.get("/:id", async (c) => {
  const flowId = c.req.param("id");
  const appDb = createAppDb(c.env.APP_DB);

  const result = await appDb.select().from(flows).where(eq(flows.id, flowId)).limit(1);

  if (result.length === 0) {
    return c.json({ detail: "Flow not found" }, 404);
  }

  const flow = result[0]!;
  return c.json({
    id: flow.id,
    name: flow.name,
    system_prompt: flow.systemPrompt,
    variables: JSON.parse(flow.variables || "[]"),
    user_id: flow.userId,
    created_at: flow.createdAt,
    updated_at: flow.updatedAt,
  });
});

// PUT /flows/:id - matches existing response
flowsRoutes.put("/:id", zValidator("json", updateFlowRequestSchema), async (c) => {
  const user = c.get("user")!;
  const flowId = c.req.param("id");
  const { name, system_prompt } = c.req.valid("json");

  const appDb = createAppDb(c.env.APP_DB);

  const existing = await appDb
    .select()
    .from(flows)
    .where(eq(flows.id, flowId))
    .limit(1);

  if (existing.length === 0) {
    return c.json({ detail: "Flow not found" }, 404);
  }

  const existingFlow = existing[0]!;

  // Check ownership (admin bypass)
  if (existingFlow.userId !== user.id && !user.roles.includes("admin")) {
    return c.json({ detail: "Not authorized to modify this flow" }, 403);
  }

  const newSystemPrompt = system_prompt || existingFlow.systemPrompt;
  const variables = extractVariables(newSystemPrompt);
  const now = new Date().toISOString();

  await appDb
    .update(flows)
    .set({
      name: name || existingFlow.name,
      systemPrompt: newSystemPrompt,
      variables: JSON.stringify(variables),
      updatedAt: now,
    })
    .where(eq(flows.id, flowId));

  // Invalidate cache
  await c.env.KV.delete(`flow:${flowId}`);

  return c.json({
    id: flowId,
    name: name || existingFlow.name,
    system_prompt: newSystemPrompt,
    variables,
    user_id: existingFlow.userId,
    created_at: existingFlow.createdAt,
    updated_at: now,
  });
});

// DELETE /flows/:id
flowsRoutes.delete("/:id", async (c) => {
  const user = c.get("user")!;
  const flowId = c.req.param("id");
  const appDb = createAppDb(c.env.APP_DB);

  const existing = await appDb.select().from(flows).where(eq(flows.id, flowId)).limit(1);

  if (existing.length === 0) {
    return c.json({ detail: "Flow not found" }, 404);
  }

  const existingFlow = existing[0]!;

  if (existingFlow.userId !== user.id && !user.roles.includes("admin")) {
    return c.json({ detail: "Not authorized to delete this flow" }, 403);
  }

  await appDb.delete(flows).where(eq(flows.id, flowId));
  await c.env.KV.delete(`flow:${flowId}`);

  return c.json({ message: "Flow deleted successfully" });
});
