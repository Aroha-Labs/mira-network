import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { zValidator } from "@hono/zod-validator";
import type { AppContext } from "../env";
import { authMiddleware } from "../middleware/auth";
import { getAllModels, getModel, isWorkersAI, type Provider } from "../lib/models";
import { chatCompletionRequestSchema, verifyRequestSchema } from "../schemas";
import { calculateCost, deductCredits, estimateTokens } from "../lib/credits";

export const aiRoutes = new Hono<AppContext>();

// GET /v1/models - matches existing response structure
aiRoutes.get("/models", (c) => {
  return c.json(getAllModels());
});

// Helper to build AI Gateway URL for external providers (Unified Billing)
function getGatewayUrl(env: AppContext["Bindings"], provider: Provider, endpoint: string): string {
  return `https://gateway.ai.cloudflare.com/v1/${env.CF_ACCOUNT_ID}/${env.GATEWAY_ID}/${provider}/${endpoint}`;
}

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

    const startTime = Date.now();
    console.log("[ai] Request:", { model, provider: modelInfo.provider, stream, messageCount: messages.length });

    // Workers AI models use env.AI.run()
    if (isWorkersAI(modelInfo)) {
      return handleWorkersAI(c, modelInfo, messages, stream, max_tokens, tools, tool_choice, user, isFreeModel, model);
    }

    // External providers use HTTP fetch to AI Gateway
    return handleExternalProvider(c, modelInfo, messages, stream, max_tokens, tools, tool_choice, user, isFreeModel, model);
  }
);

// Handle Workers AI models via env.AI.run()
async function handleWorkersAI(
  c: any,
  modelInfo: ReturnType<typeof getModel>,
  messages: any[],
  stream: boolean | undefined,
  max_tokens: number | undefined,
  tools: any,
  tool_choice: any,
  user: { id: string },
  isFreeModel: boolean,
  model: string
) {
  const aiOptions = {
    gateway: {
      id: c.env.GATEWAY_ID,
      metadata: { user_id: user.id },
    },
  };

  if (stream) {
    return streamSSE(c, async (sseStream) => {
      try {
        const response = await c.env.AI.run(
          modelInfo!.providerModel as Parameters<typeof c.env.AI.run>[0],
          { messages, stream: true, max_tokens, tools, tool_choice },
          aiOptions
        );

        if (response instanceof ReadableStream) {
          const reader = response.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          let fullContent = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              const jsonStr = line.slice(6);
              if (jsonStr.trim() === '[DONE]') continue;

              try {
                const parsed = JSON.parse(jsonStr);
                if (parsed.response) {
                  fullContent += parsed.response;
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
              } catch {}
            }
          }

          // Deduct credits
          if (!isFreeModel && fullContent.length > 0) {
            const promptText = messages.map((m: { content: string }) => m.content).join(" ");
            const usage = {
              prompt_tokens: estimateTokens(promptText),
              completion_tokens: estimateTokens(fullContent),
              total_tokens: 0,
            };
            usage.total_tokens = usage.prompt_tokens + usage.completion_tokens;
            const cost = calculateCost(modelInfo!, usage);
            await deductCredits(c.env, user.id, cost, model, usage);
          }

          const finalChunk = {
            id: `chatcmpl-${crypto.randomUUID()}`,
            object: "chat.completion.chunk",
            created: Math.floor(Date.now() / 1000),
            model,
            choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
          };
          await sseStream.writeSSE({ data: JSON.stringify(finalChunk) });
        }
        await sseStream.writeSSE({ data: "[DONE]" });
      } catch (error) {
        console.log("[ai] Workers AI streaming error:", error);
        await sseStream.writeSSE({ data: JSON.stringify({ error: String(error) }) });
      }
    });
  }

  // Non-streaming
  const response = await c.env.AI.run(
    modelInfo!.providerModel as Parameters<typeof c.env.AI.run>[0],
    { messages, max_tokens, tools, tool_choice },
    aiOptions
  );

  const aiResponse = response as { response?: string; usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number } };
  const usage = aiResponse.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

  if (!isFreeModel && (usage.prompt_tokens > 0 || usage.completion_tokens > 0)) {
    const cost = calculateCost(modelInfo!, usage);
    await deductCredits(c.env, user.id, cost, model, usage);
  }

  return c.json({
    id: `chatcmpl-${crypto.randomUUID()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{
      index: 0,
      message: { role: "assistant", content: aiResponse.response || "", tool_calls: null },
      finish_reason: "stop",
    }],
    usage,
  });
}

// Handle external providers via AI Gateway HTTP (Unified Billing)
async function handleExternalProvider(
  c: any,
  modelInfo: ReturnType<typeof getModel>,
  messages: any[],
  stream: boolean | undefined,
  max_tokens: number | undefined,
  tools: any,
  tool_choice: any,
  user: { id: string },
  isFreeModel: boolean,
  model: string
) {
  const provider = modelInfo!.provider;

  // Build request based on provider
  let url: string;
  let headers: Record<string, string>;
  let body: any;

  // Unified Billing: use cf-aig-authorization with Cloudflare API token
  const baseHeaders = {
    "Content-Type": "application/json",
    "cf-aig-authorization": `Bearer ${c.env.CF_API_TOKEN}`,
    "cf-aig-metadata": JSON.stringify({ user_id: user.id }),
  };

  if (provider === "anthropic") {
    url = getGatewayUrl(c.env, provider, "v1/messages");
    headers = {
      ...baseHeaders,
      "anthropic-version": "2023-06-01",
    };
    body = {
      model: modelInfo!.providerModel,
      max_tokens: max_tokens || 4096,
      messages: messages.filter((m: any) => m.role !== "system"),
      system: messages.find((m: any) => m.role === "system")?.content,
      stream,
    };
    if (tools) body.tools = tools;
  } else {
    // OpenAI-compatible providers (openai, groq, google-ai-studio)
    url = getGatewayUrl(c.env, provider, "chat/completions");
    headers = baseHeaders;
    body = {
      model: modelInfo!.providerModel,
      messages,
      stream,
      max_tokens,
    };
    if (tools) body.tools = tools;
    if (tool_choice) body.tool_choice = tool_choice;
  }

  console.log("[ai] External provider request:", { provider, url, model: modelInfo!.providerModel, stream });

  if (stream) {
    return streamSSE(c, async (sseStream) => {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.log("[ai] Provider error:", response.status, errorText);
          await sseStream.writeSSE({ data: JSON.stringify({ error: errorText }) });
          return;
        }

        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let fullContent = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const jsonStr = line.slice(6).trim();
            if (jsonStr === '[DONE]') continue;

            try {
              const parsed = JSON.parse(jsonStr);

              if (provider === "anthropic") {
                // Handle Anthropic streaming format
                if (parsed.type === "content_block_delta" && parsed.delta?.text) {
                  fullContent += parsed.delta.text;
                  const chunk = {
                    id: `chatcmpl-${crypto.randomUUID()}`,
                    object: "chat.completion.chunk",
                    created: Math.floor(Date.now() / 1000),
                    model,
                    choices: [{
                      index: 0,
                      delta: { content: parsed.delta.text },
                      finish_reason: null,
                    }],
                  };
                  await sseStream.writeSSE({ data: JSON.stringify(chunk) });
                }
              } else {
                // OpenAI-compatible format
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) {
                  fullContent += content;
                }
                await sseStream.writeSSE({ data: JSON.stringify(parsed) });
              }
            } catch {}
          }
        }

        // Deduct credits
        if (!isFreeModel && fullContent.length > 0) {
          const promptText = messages.map((m: { content: string }) => m.content).join(" ");
          const usage = {
            prompt_tokens: estimateTokens(promptText),
            completion_tokens: estimateTokens(fullContent),
            total_tokens: 0,
          };
          usage.total_tokens = usage.prompt_tokens + usage.completion_tokens;
          const cost = calculateCost(modelInfo!, usage);
          await deductCredits(c.env, user.id, cost, model, usage);
        }

        await sseStream.writeSSE({ data: "[DONE]" });
      } catch (error) {
        console.log("[ai] External provider streaming error:", error);
        await sseStream.writeSSE({ data: JSON.stringify({ error: String(error) }) });
      }
    });
  }

  // Non-streaming
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.log("[ai] Provider error:", response.status, errorText);
    return c.json({ error: { message: errorText, type: "upstream_error" } }, response.status);
  }

  const data = await response.json() as any;

  // Normalize Anthropic response to OpenAI format
  if (provider === "anthropic") {
    const content = data.content?.[0]?.text || "";
    const usage = {
      prompt_tokens: data.usage?.input_tokens || 0,
      completion_tokens: data.usage?.output_tokens || 0,
      total_tokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
    };

    if (!isFreeModel && usage.total_tokens > 0) {
      const cost = calculateCost(modelInfo!, usage);
      await deductCredits(c.env, user.id, cost, model, usage);
    }

    return c.json({
      id: `chatcmpl-${data.id}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [{
        index: 0,
        message: { role: "assistant", content, tool_calls: null },
        finish_reason: data.stop_reason === "end_turn" ? "stop" : data.stop_reason,
      }],
      usage,
    });
  }

  // OpenAI-compatible response
  const usage = data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
  if (!isFreeModel && usage.total_tokens > 0) {
    const cost = calculateCost(modelInfo!, usage);
    await deductCredits(c.env, user.id, cost, model, usage);
  }

  return c.json(data);
}

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

          // For simplicity, use non-streaming for verification
          // This could be optimized to use the same provider routing as chat completions
          if (isWorkersAI(modelInfo)) {
            const aiOptions = {
              gateway: {
                id: c.env.GATEWAY_ID,
                metadata: { user_id: user.id },
              },
            };

            const response = await c.env.AI.run(
              modelInfo.providerModel as Parameters<typeof c.env.AI.run>[0],
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
          } else {
            // External provider - simplified for now
            return {
              result: "no",
              reason: "Verification not yet supported for external providers",
              response: { error: "Not implemented" },
              model: modelId,
              usage: {},
              cost: 0,
            };
          }
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
      results: results.map(({ cost, ...r }) => r),
    });
  }
);
