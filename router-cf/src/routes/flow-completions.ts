import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { zValidator } from "@hono/zod-validator";
import type { AppContext } from "../env";
import { authMiddleware } from "../middleware/auth";
import { createAppDb, flows } from "../db";
import { eq } from "drizzle-orm";
import { getModel } from "../lib/models";
import { flowChatCompletionRequestSchema } from "../schemas";

export const flowCompletionsRoutes = new Hono<AppContext>();

flowCompletionsRoutes.use("*", authMiddleware);

// POST /v1/flow/:id/chat/completions - matches existing response
flowCompletionsRoutes.post(
  "/:id/chat/completions",
  zValidator("json", flowChatCompletionRequestSchema),
  async (c) => {
    const user = c.get("user")!;
    const flowId = c.req.param("id");
    const { model, messages, variables = {}, stream, tools, tool_choice } = c.req.valid("json");

  // Check credits
  const creditsStr = await c.env.KV.get(`credits:${user.id}`);
  const credits = creditsStr ? parseFloat(creditsStr) : 0;
  if (credits <= 0) {
    return c.json({ detail: "Insufficient credits" }, 402);
  }

  // Check for system message in request (not allowed)
  if (messages.some((msg: { role: string }) => msg.role === "system")) {
    return c.json({ detail: "System message is not allowed in request" }, 400);
  }

  // Try KV cache first, then D1
  let flowData: { systemPrompt: string; variables: string[] } | null = null;

  const cached = await c.env.KV.get(`flow:${flowId}`, "json");
  if (cached) {
    flowData = cached as { systemPrompt: string; variables: string[] };
  } else {
    const appDb = createAppDb(c.env.APP_DB);
    const result = await appDb.select().from(flows).where(eq(flows.id, flowId)).limit(1);

    if (result.length === 0) {
      return c.json({ detail: "Flow not found" }, 404);
    }

    const flow = result[0]!;
    flowData = {
      systemPrompt: flow.systemPrompt,
      variables: JSON.parse(flow.variables || "[]"),
    };

    // Cache for 5 minutes
    await c.env.KV.put(`flow:${flowId}`, JSON.stringify(flowData), { expirationTtl: 300 });
  }

  const requiredVars = flowData.variables;

  // Validate variables
  if (requiredVars.length > 0) {
    if (!variables || Object.keys(variables).length === 0) {
      return c.json({ detail: "Variables are required but none were provided" }, 400);
    }

    const missingVars = requiredVars.filter((v) => !(v in variables));
    if (missingVars.length > 0) {
      return c.json({ detail: `Missing required variables: ${missingVars.join(", ")}` }, 400);
    }
  }

  // Replace variables in system prompt
  let systemPrompt = flowData.systemPrompt;
  for (const [key, value] of Object.entries(variables)) {
    systemPrompt = systemPrompt.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), String(value));
  }

  const modelInfo = getModel(model);
  if (!modelInfo) {
    return c.json({ detail: `Unsupported model: ${model}` }, 400);
  }

  const fullMessages = [{ role: "system", content: systemPrompt }, ...messages];

  const aiOptions = {
    gateway: { id: c.env.GATEWAY_ID },
  };

  const startTime = Date.now();

  if (stream) {
    return streamSSE(c, async (sseStream) => {
      try {
        const response = await c.env.AI.run(
          modelInfo.cfModel as Parameters<typeof c.env.AI.run>[0],
          { messages: fullMessages, stream: true, tools, tool_choice },
          aiOptions
        );

        if (response instanceof ReadableStream) {
          const reader = response.getReader();
          const decoder = new TextDecoder();

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            await sseStream.writeSSE({ data: decoder.decode(value) });
          }
        }

        await sseStream.writeSSE({ data: "[DONE]" });
      } catch (error) {
        await sseStream.writeSSE({ data: JSON.stringify({ error: String(error) }) });
      }
    });
  }

  // Non-streaming
  const response = await c.env.AI.run(
    modelInfo.cfModel as Parameters<typeof c.env.AI.run>[0],
    { messages: fullMessages, tools, tool_choice },
    aiOptions
  );

  const aiResponse = response as { response?: string; usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number } };

  // Match existing OpenAI-compatible response
  return c.json({
    id: `chatcmpl-${crypto.randomUUID()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: aiResponse.response || "",
          tool_calls: null,
        },
        finish_reason: "stop",
      },
    ],
    usage: aiResponse.usage || {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
    },
  });
});
