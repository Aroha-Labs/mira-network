import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { zValidator } from "@hono/zod-validator";
import OpenAI from "openai";
import type { AppContext } from "../env";
import { authMiddleware } from "../middleware/auth";
import { eq } from "drizzle-orm";
import { getAllModels, getModel } from "../lib/models";
import { chatCompletionRequestSchema, verifyRequestSchema, verifyFactRequestSchema } from "../schemas";
import { calculateCost, deductCredits, estimateTokens, getUserCredits } from "../lib/credits";
import { verifyFact, type Domain } from "../lib/verify/engine";
import { createAppDb, verificationResults } from "../db";

export const aiRoutes = new Hono<AppContext>();

// Create OpenAI client for AI Gateway -> OpenRouter (BYOK)
// Note: We must strip the Authorization header — the gateway rejects requests
// that include it, even when cf-aig-authorization is present.
function createGatewayClient(env: AppContext["Bindings"]) {
  return new OpenAI({
    apiKey: "placeholder",
    baseURL: `https://gateway.ai.cloudflare.com/v1/${env.CF_ACCOUNT_ID}/${env.GATEWAY_ID}/openrouter`,
    defaultHeaders: {
      "cf-aig-authorization": `Bearer ${env.CF_API_TOKEN}`,
      "cf-aig-byok-alias": "default",
      Authorization: "",
    },
  });
}

// GET /v1/models
aiRoutes.get("/models", (c) => {
  return c.json(getAllModels());
});

// POST /v1/chat/completions
aiRoutes.post(
  "/chat/completions",
  authMiddleware,
  zValidator("json", chatCompletionRequestSchema),
  async (c) => {
    const { model, messages, stream, max_tokens, tools, tool_choice } = c.req.valid("json");

    const modelInfo = getModel(model);
    if (!modelInfo) {
      return c.json({ error: { message: `Unsupported model: ${model}`, type: "invalid_request_error" } }, 400);
    }

    const user = c.get("user")!;

    // Check credits (skip for free models)
    const isFreeModel = modelInfo.promptTokenPrice === 0 && modelInfo.completionTokenPrice === 0;
    if (!isFreeModel) {
      const credits = await getUserCredits(c.env, user.id);
      if (credits <= 0) {
        return c.json({ detail: "Insufficient credits" }, 402);
      }
    }

    const client = createGatewayClient(c.env);
    console.log("[ai] Request:", { model, gatewayModel: modelInfo.gatewayModel, stream });

    try {
      if (stream) {
        return streamSSE(c, async (sseStream) => {
          try {
            const streamResponse = await client.chat.completions.create({
              model: modelInfo.gatewayModel,
              messages: messages as OpenAI.ChatCompletionMessageParam[],
              stream: true,
              max_tokens,
              tools: tools as OpenAI.ChatCompletionTool[],
              tool_choice: tool_choice as OpenAI.ChatCompletionToolChoiceOption,
            });

            let fullContent = "";

            for await (const chunk of streamResponse) {
              const content = chunk.choices[0]?.delta?.content;
              if (content) {
                fullContent += content;
              }
              await sseStream.writeSSE({ data: JSON.stringify(chunk) });
            }

            await sseStream.writeSSE({ data: "[DONE]" });

            // Deduct credits after streaming completes
            if (!isFreeModel && fullContent.length > 0) {
              const promptText = messages.map((m: any) => m.content).join(" ");
              const usage = {
                prompt_tokens: estimateTokens(promptText),
                completion_tokens: estimateTokens(fullContent),
                total_tokens: 0,
              };
              usage.total_tokens = usage.prompt_tokens + usage.completion_tokens;
              const cost = calculateCost(modelInfo, usage);
              await deductCredits(c.env, user.id, cost, model, usage);
            }
          } catch (error) {
            console.log("[ai] Streaming error:", error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            await sseStream.writeSSE({ data: JSON.stringify({ error: errorMessage }) });
          }
        });
      }

      // Non-streaming
      const response = await client.chat.completions.create({
        model: modelInfo.gatewayModel,
        messages: messages as OpenAI.ChatCompletionMessageParam[],
        max_tokens,
        tools: tools as OpenAI.ChatCompletionTool[],
        tool_choice: tool_choice as OpenAI.ChatCompletionToolChoiceOption,
      });

      // Deduct credits
      const usage = response.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
      if (!isFreeModel && usage.total_tokens > 0) {
        const cost = calculateCost(modelInfo, usage);
        await deductCredits(c.env, user.id, cost, model, usage);
      }

      return c.json(response);
    } catch (error) {
      console.log("[ai] Error:", error);
      if (error instanceof OpenAI.APIError) {
        return c.json({ error: { message: error.message, type: "api_error" } }, error.status || 500);
      }
      throw error;
    }
  }
);

// POST /v1/verify
aiRoutes.post(
  "/verify",
  authMiddleware,
  zValidator("json", verifyRequestSchema),
  async (c) => {
    const { messages, models } = c.req.valid("json");
    const minYes = c.req.valid("json").min_yes ?? 1;

    if (minYes > models.length) {
      return c.json({ detail: "min_yes must be <= number of models" }, 400);
    }

    const user = c.get("user")!;

    // Check credits
    const credits = await getUserCredits(c.env, user.id);
    if (credits <= 0) {
      return c.json({ detail: "Insufficient credits" }, 402);
    }

    const client = createGatewayClient(c.env);

    const verificationTool: OpenAI.ChatCompletionTool = {
      type: "function",
      function: {
        name: "provide_verification_result",
        description: "Provide a yes or no verification result with a detailed reason",
        parameters: {
          type: "object",
          properties: {
            result: { type: "string", enum: ["yes", "no"] },
            reason: { type: "string" },
          },
          required: ["result", "reason"],
        },
      },
    };

    const promptText = messages.map((m: any) => m.content).join(" ");

    const results = await Promise.all(
      models.map(async (modelId: string) => {
        const modelInfo = getModel(modelId);
        if (!modelInfo) {
          return { result: "no", reason: "Model not found", model: modelId, usage: {}, cost: 0 };
        }

        try {
          const response = await client.chat.completions.create({
            model: modelInfo.gatewayModel,
            messages: [
              { role: "system", content: "You are a verification assistant. Analyze the conversation and provide a yes/no result with a detailed reason using the provided tool." },
              ...(messages as OpenAI.ChatCompletionMessageParam[]),
            ],
            tools: [verificationTool],
            tool_choice: { type: "function", function: { name: "provide_verification_result" } },
          });

          let result = "no";
          let reason = "No valid response received";

          const toolCall = response.choices[0]?.message?.tool_calls?.[0] as any;
          if (toolCall?.function?.arguments) {
            try {
              const args = JSON.parse(toolCall.function.arguments as string);
              result = args.result || "no";
              reason = args.reason || "No reason provided";
            } catch {}
          }

          const usage = response.usage || { prompt_tokens: estimateTokens(promptText), completion_tokens: estimateTokens(reason), total_tokens: 0 };
          const cost = calculateCost(modelInfo, usage);

          return {
            result,
            response: { choices: [{ message: { content: reason } }] },
            model: modelId,
            usage,
            cost,
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          return { result: "no", reason: `Error: ${errorMessage}`, model: modelId, usage: {}, cost: 0 };
        }
      })
    );

    // Deduct total cost
    const totalCost = results.reduce((sum, r) => sum + (r.cost || 0), 0);
    if (totalCost > 0) {
      const totalUsage = {
        prompt_tokens: results.reduce((sum, r) => sum + ((r.usage as any)?.prompt_tokens || 0), 0),
        completion_tokens: results.reduce((sum, r) => sum + ((r.usage as any)?.completion_tokens || 0), 0),
        total_tokens: 0,
      };
      totalUsage.total_tokens = totalUsage.prompt_tokens + totalUsage.completion_tokens;
      await deductCredits(c.env, user.id, totalCost, `verify:${models.join(",")}`, totalUsage);
    }

    const yesCount = results.filter((r) => r.result === "yes").length;

    return c.json({
      result: yesCount >= minYes ? "yes" : "no",
      results: results.map(({ cost, ...r }) => r),
    });
  }
);

// POST /v1/verify/stream
// Rich fact verification: binarize a statement into multiple-choice questions,
// query several models per claim, take consensus, label TRUE/FALSE/NO CONSENSUS.
// Progress is streamed as SSE; the final `result` event carries the saved id.
aiRoutes.post(
  "/verify/stream",
  authMiddleware,
  zValidator("json", verifyFactRequestSchema),
  async (c) => {
    const { fact, minRequired, totalModels, url, domain } = c.req.valid("json");
    const user = c.get("user")!;

    // Pre-check credits — the run fans out across several model calls.
    const credits = await getUserCredits(c.env, user.id);
    if (credits <= 0) {
      return c.json({ detail: "Insufficient credits" }, 402);
    }

    const client = createGatewayClient(c.env);

    return streamSSE(c, async (sseStream) => {
      const send = (event: string, data: unknown) =>
        sseStream.writeSSE({ event, data: JSON.stringify(data) });

      try {
        const { response, modelUsage } = await verifyFact(
          client,
          {
            fact,
            minRequired: minRequired ?? 2,
            totalModels: totalModels ?? 3,
            url,
            domain: (domain as Domain) ?? "general",
          },
          (event) => send(event.type, event),
        );

        // Price each model's usage and deduct once.
        let totalCost = 0;
        for (const [modelId, usage] of Object.entries(modelUsage)) {
          const modelInfo = getModel(modelId);
          if (modelInfo) totalCost += calculateCost(modelInfo, usage);
        }
        if (totalCost > 0) {
          const totals = Object.values(modelUsage).reduce(
            (acc, u) => ({
              prompt_tokens: acc.prompt_tokens + u.prompt_tokens,
              completion_tokens: acc.completion_tokens + u.completion_tokens,
              total_tokens: acc.total_tokens + u.total_tokens,
            }),
            { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
          );
          await deductCredits(c.env, user.id, totalCost, "verify:stream", totals);
        }

        // Persist the result so it can be retrieved/shared by id.
        const id = crypto.randomUUID();
        try {
          const appDb = createAppDb(c.env.APP_DB);
          await appDb.insert(verificationResults).values({
            id,
            userId: user.id,
            requestId: response.requestId,
            originalFact: response.original_fact,
            domain: response.domain,
            url: response.url ?? null,
            minRequired: String(response.minRequired),
            results: JSON.stringify(response.results),
            tokenUsage: JSON.stringify(modelUsage),
            createdAt: new Date().toISOString(),
          });
        } catch (error) {
          // Persistence is best-effort; don't fail the verification on it.
          console.log("[verify] Failed to save result:", error);
        }

        await send("result", { ...response, documentId: id });
        await sseStream.writeSSE({ data: "[DONE]" });
      } catch (error) {
        console.log("[verify] Error:", error);
        const message = error instanceof Error ? error.message : String(error);
        await send("error", { message });
      }
    });
  }
);

// GET /v1/verification/:id - fetch a saved verification result
aiRoutes.get("/verification/:id", authMiddleware, async (c) => {
  const id = c.req.param("id");
  const user = c.get("user")!;
  const appDb = createAppDb(c.env.APP_DB);

  const [row] = await appDb
    .select()
    .from(verificationResults)
    .where(eq(verificationResults.id, id))
    .limit(1);

  if (!row || row.userId !== user.id) {
    return c.json({ detail: "Verification not found" }, 404);
  }

  return c.json({
    documentId: row.id,
    requestId: row.requestId,
    original_fact: row.originalFact,
    domain: row.domain,
    url: row.url,
    minRequired: row.minRequired ? Number(row.minRequired) : undefined,
    results: JSON.parse(row.results),
    tokenUsage: row.tokenUsage ? JSON.parse(row.tokenUsage) : undefined,
    timestamp: row.createdAt,
  });
});
