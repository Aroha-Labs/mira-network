import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { zValidator } from "@hono/zod-validator";
import OpenAI from "openai";
import type { AppContext } from "../env";
import { authMiddleware } from "../middleware/auth";
import { createAppDb, flows } from "../db";
import { eq } from "drizzle-orm";
import { getModel } from "../lib/models";
import { flowChatCompletionRequestSchema } from "../schemas";

export const flowCompletionsRoutes = new Hono<AppContext>();

flowCompletionsRoutes.use("*", authMiddleware);

// Create OpenAI client for AI Gateway (Unified Billing)
function createGatewayClient(env: AppContext["Bindings"]) {
  return new OpenAI({
    apiKey: env.CF_API_TOKEN,
    baseURL: `https://gateway.ai.cloudflare.com/v1/${env.CF_ACCOUNT_ID}/${env.GATEWAY_ID}/compat`,
  });
}

// POST /v1/flow/:id/chat/completions
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

    const fullMessages: OpenAI.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...(messages as OpenAI.ChatCompletionMessageParam[]),
    ];

    const client = createGatewayClient(c.env);

    try {
      if (stream) {
        return streamSSE(c, async (sseStream) => {
          try {
            const streamResponse = await client.chat.completions.create({
              model: modelInfo.gatewayModel,
              messages: fullMessages,
              stream: true,
              tools: tools as OpenAI.ChatCompletionTool[],
              tool_choice: tool_choice as OpenAI.ChatCompletionToolChoiceOption,
            });

            for await (const chunk of streamResponse) {
              await sseStream.writeSSE({ data: JSON.stringify(chunk) });
            }

            await sseStream.writeSSE({ data: "[DONE]" });
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            await sseStream.writeSSE({ data: JSON.stringify({ error: errorMessage }) });
          }
        });
      }

      // Non-streaming
      const response = await client.chat.completions.create({
        model: modelInfo.gatewayModel,
        messages: fullMessages,
        tools: tools as OpenAI.ChatCompletionTool[],
        tool_choice: tool_choice as OpenAI.ChatCompletionToolChoiceOption,
      });

      return c.json(response);
    } catch (error) {
      if (error instanceof OpenAI.APIError) {
        return c.json({ error: { message: error.message, type: "api_error" } }, error.status || 500);
      }
      throw error;
    }
  }
);
