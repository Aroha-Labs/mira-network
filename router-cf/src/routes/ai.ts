import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { zValidator } from "@hono/zod-validator";
import type { AppContext } from "../env";
import { authMiddleware } from "../middleware/auth";
import { getAllModels, getModel } from "../lib/models";
import { chatCompletionRequestSchema, verifyRequestSchema } from "../schemas";
import { calculateCost, deductCredits, estimateTokens } from "../lib/credits";

export const aiRoutes = new Hono<AppContext>();

// GET /v1/models - matches existing response structure
aiRoutes.get("/models", (c) => {
  return c.json(getAllModels());
});

// POST /v1/chat/completions - OpenAI-compatible
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

  // Check credits from KV (skip for free models)
  const isFreeModel = modelInfo.promptTokenPrice === 0 && modelInfo.completionTokenPrice === 0;
  if (!isFreeModel) {
    const creditsStr = await c.env.KV.get(`credits:${user.id}`);
    const credits = creditsStr ? parseFloat(creditsStr) : 0;
    if (credits <= 0) {
      return c.json({ detail: "Insufficient credits" }, 402);
    }
  }

  const aiOptions = {
    gateway: { id: c.env.GATEWAY_ID },
  };

  const startTime = Date.now();
  console.log("[ai] Request:", { model, stream, messageCount: messages.length, gatewayId: c.env.GATEWAY_ID });

  if (stream) {
    console.log("[ai] Using streaming path");
    return streamSSE(c, async (sseStream) => {
      try {
        console.log("[ai] Calling AI.run with model:", modelInfo.cfModel);
        const response = await c.env.AI.run(
          modelInfo.cfModel as Parameters<typeof c.env.AI.run>[0],
          { messages, stream: true, max_tokens, tools, tool_choice },
          aiOptions
        );
        console.log("[ai] AI.run response type:", typeof response, response instanceof ReadableStream ? "ReadableStream" : "other");

        if (response instanceof ReadableStream) {
          const reader = response.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          let fullContent = ""; // Track full response for credit calculation

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            // Process complete lines from buffer
            const lines = buffer.split('\n');
            buffer = lines.pop() || ""; // Keep incomplete line in buffer

            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              const jsonStr = line.slice(6); // Remove "data: "
              if (jsonStr.trim() === '[DONE]') continue;

              try {
                const parsed = JSON.parse(jsonStr);
                if (parsed.response) {
                  fullContent += parsed.response; // Track for credits
                  // Convert to OpenAI format
                  const openAIChunk = {
                    id: `chatcmpl-${crypto.randomUUID()}`,
                    object: "chat.completion.chunk",
                    created: Math.floor(Date.now() / 1000),
                    model,
                    choices: [{
                      index: 0,
                      delta: { content: parsed.response },
                      finish_reason: null,
                    }],
                  };
                  await sseStream.writeSSE({ data: JSON.stringify(openAIChunk) });
                }
              } catch {
                // Skip malformed JSON
              }
            }
          }

          // Process any remaining buffer
          if (buffer.startsWith('data: ')) {
            const jsonStr = buffer.slice(6);
            try {
              const parsed = JSON.parse(jsonStr);
              if (parsed.response) {
                fullContent += parsed.response;
                const openAIChunk = {
                  id: `chatcmpl-${crypto.randomUUID()}`,
                  object: "chat.completion.chunk",
                  created: Math.floor(Date.now() / 1000),
                  model,
                  choices: [{ index: 0, delta: { content: parsed.response }, finish_reason: null }],
                };
                await sseStream.writeSSE({ data: JSON.stringify(openAIChunk) });
              }
            } catch {}
          }

          // Deduct credits for streaming (estimate tokens from content)
          if (!isFreeModel && fullContent.length > 0) {
            const promptText = messages.map((m: { content: string }) => m.content).join(" ");
            const usage = {
              prompt_tokens: estimateTokens(promptText),
              completion_tokens: estimateTokens(fullContent),
              total_tokens: 0,
            };
            usage.total_tokens = usage.prompt_tokens + usage.completion_tokens;
            const cost = calculateCost(modelInfo, usage);
            await deductCredits(c.env, user.id, cost, model, usage);
          }

          // Send final chunk with finish_reason
          const finalChunk = {
            id: `chatcmpl-${crypto.randomUUID()}`,
            object: "chat.completion.chunk",
            created: Math.floor(Date.now() / 1000),
            model,
            choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
          };
          await sseStream.writeSSE({ data: JSON.stringify(finalChunk) });
        } else {
          console.log("[ai] Non-stream response:", JSON.stringify(response).slice(0, 200));
        }

        await sseStream.writeSSE({ data: "[DONE]" });
      } catch (error) {
        console.log("[ai] Streaming error:", error);
        await sseStream.writeSSE({ data: JSON.stringify({ error: String(error) }) });
      }
    });
  }

  // Non-streaming response
  const response = await c.env.AI.run(
    modelInfo.cfModel as Parameters<typeof c.env.AI.run>[0],
    { messages, max_tokens, tools, tool_choice },
    aiOptions
  );

  const responseTime = (Date.now() - startTime) / 1000;
  console.log("[ai] Raw response:", JSON.stringify(response));
  const aiResponse = response as { response?: string; usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number } };

  // Deduct credits based on usage (skip for free models)
  const usage = aiResponse.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
  if (!isFreeModel && (usage.prompt_tokens > 0 || usage.completion_tokens > 0)) {
    const cost = calculateCost(modelInfo, usage);
    await deductCredits(c.env, user.id, cost, model, usage);
  }

  // Match existing OpenAI-compatible response structure
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

// POST /v1/verify - matches existing response structure
aiRoutes.post(
  "/verify",
  authMiddleware,
  zValidator("json", verifyRequestSchema),
  async (c) => {
    const { messages, models } = c.req.valid("json");
    const minYes = c.req.valid("json").min_yes ?? 1;

    if (minYes > models.length) {
      return c.json({ detail: "Minimum yes must be less than or equal to the number of models" }, 400);
    }

  const user = c.get("user")!;

  // Check credits
  const creditsStr = await c.env.KV.get(`credits:${user.id}`);
  const credits = creditsStr ? parseFloat(creditsStr) : 0;
  if (credits <= 0) {
    return c.json({ detail: "Insufficient credits" }, 402);
  }

  const aiOptions = {
    gateway: { id: c.env.GATEWAY_ID },
  };

  // Verification tool definition
  const verificationTool = {
    type: "function",
    function: {
      name: "provide_verification_result",
      description: "Provide a yes or no verification result with a detailed reason",
      parameters: {
        type: "object",
        properties: {
          result: {
            type: "string",
            enum: ["yes", "no"],
            description: "The verification result - either 'yes' or 'no'",
          },
          reason: {
            type: "string",
            description: "Detailed explanation for the verification result",
          },
        },
        required: ["result", "reason"],
      },
    },
  };

  // Process all models in parallel
  const promptText = messages.map((m: { content: string }) => m.content).join(" ");
  const estimatedPromptTokens = estimateTokens(promptText);

  const results = await Promise.all(
    models.map(async (modelId: string) => {
      const modelInfo = getModel(modelId);
      if (!modelInfo) {
        return { result: "no", reason: "Model not found", response: { error: "Model not found" }, model: modelId, usage: {}, cost: 0 };
      }

      try {
        const verificationMessages = [
          { role: "system", content: "You are a verification assistant. Analyze the conversation and provide a yes/no result with a detailed reason using the provided tool." },
          ...messages,
        ];

        const response = await c.env.AI.run(
          modelInfo.cfModel as Parameters<typeof c.env.AI.run>[0],
          { messages: verificationMessages, tools: [verificationTool] },
          aiOptions
        );

        const aiResponse = response as {
          response?: string;
          tool_calls?: Array<{ function: { arguments: string } }>;
          usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
        };

        let result = "no";
        let reason = "No valid response received";

        if (aiResponse.tool_calls && aiResponse.tool_calls[0]) {
          try {
            const args = JSON.parse(aiResponse.tool_calls[0].function.arguments);
            result = args.result || "no";
            reason = args.reason || "No reason provided";
          } catch {
            result = "no";
            reason = "Failed to parse verification result";
          }
        }

        // Calculate cost for this model
        const usage = aiResponse.usage || {
          prompt_tokens: estimatedPromptTokens,
          completion_tokens: estimateTokens(reason),
          total_tokens: 0
        };
        const cost = calculateCost(modelInfo, usage);

        return {
          result,
          response: { choices: [{ message: { content: reason } }] },
          model: modelId,
          usage,
          cost,
        };
      } catch (error) {
        return {
          result: "no",
          reason: `Error during verification: ${String(error)}`,
          response: { error: String(error) },
          model: modelId,
          usage: {},
          cost: 0,
        };
      }
    })
  );

  // Calculate and deduct total cost
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
    results: results.map(({ cost, ...r }) => r), // Remove cost from response
  });
});
