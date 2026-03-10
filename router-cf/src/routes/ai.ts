import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { zValidator } from "@hono/zod-validator";
import OpenAI from "openai";
import type { AppContext } from "../env";
import { authMiddleware } from "../middleware/auth";
import { getAllModels, getModel } from "../lib/models";
import { chatCompletionRequestSchema, verifyRequestSchema } from "../schemas";
import { calculateCost, deductCredits, estimateTokens, getUserCredits } from "../lib/credits";

export const aiRoutes = new Hono<AppContext>();

// Create OpenAI client for AI Gateway (Unified Billing)
function createGatewayClient(env: AppContext["Bindings"]) {
  return new OpenAI({
    apiKey: env.CF_API_TOKEN,
    baseURL: `https://gateway.ai.cloudflare.com/v1/${env.CF_ACCOUNT_ID}/${env.GATEWAY_ID}/compat`,
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
