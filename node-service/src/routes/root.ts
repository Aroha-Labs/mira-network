import { FastifyPluginAsync } from "fastify";
import axios from "axios";
import { Env } from "../config";
import { registerMachine, getLocalIp } from "../utils/machineRegistry";
import OpenAI from "openai";

enum PROVIDER_NAME {
  OPENAI = "openai",
  OPENROUTER = "openrouter",
  ANTHROPIC = "anthropic",
  MIRA = "mira",
  GROQ = "groq",
}

// Model Providers
interface ModelProvider {
  baseUrl: string;
  apiKey: string;
  providerName: PROVIDER_NAME;
}

interface Message {
  role: "system" | "user" | "assistant" | "function";
  content: string;
  name?: string;
}

interface VerifyRequest {
  messages: Message[];
  model: string;
  model_provider?: ModelProvider;
}


interface VerifyFunctionArgs {
  is_correct: boolean;
  reason: string;
}

type AiRequest = OpenAI.ChatCompletionCreateParams & {
  model: string;
  modelProvider?: ModelProvider;
};

const ROUTER_BASE_URL = process.env.ROUTER_BASE_URL;

const modelProviders: Record<PROVIDER_NAME, ModelProvider> = {
  [PROVIDER_NAME.OPENAI]: {
    baseUrl: "https://api.openai.com/v1",
    apiKey: process.env.OPENAI_API_KEY || "",
    providerName: PROVIDER_NAME.OPENAI,
  },
  [PROVIDER_NAME.OPENROUTER]: {
    baseUrl: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY || "",
    providerName: PROVIDER_NAME.OPENROUTER,
  },
  [PROVIDER_NAME.ANTHROPIC]: {
    baseUrl: "https://api.anthropic.com/v1",
    apiKey: process.env.ANTHROPIC_API_KEY || "",
    providerName: PROVIDER_NAME.ANTHROPIC,
  },
  [PROVIDER_NAME.MIRA]: {
    baseUrl: process.env.MIRA_BASE_URL || "https://ollama.alts.dev/v1",
    apiKey: process.env.MIRA_API_KEY || "",
    providerName: PROVIDER_NAME.MIRA,
  },
  [PROVIDER_NAME.GROQ]: {
    baseUrl: process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1",
    apiKey: process.env.GROQ_API_KEY || "",
    providerName: PROVIDER_NAME.GROQ,
  },
};

const getModelProvider = (
  model: string,
  modelProvider?: ModelProvider
): [ModelProvider, string] => {
  if (model === "") {
    throw new Error("Model is required");
  }

  if (modelProvider) {
    return [modelProvider, model];
  }

  const [providerName, ...rest] = model.split("/") as [
    PROVIDER_NAME,
    ...string[]
  ];
  const modelName = rest.join("/");

  if (!modelName || modelName === "") {
    throw new Error("Invalid model name");
  }

  if (!modelProviders[providerName]) {
    throw new Error("Invalid model provider");
  }

  return [modelProviders[providerName], modelName];
};

type GetLlmCompletionRequest = OpenAI.ChatCompletionCreateParams & {
  model: string;
  modelProvider: ModelProvider;
  reasoning_effort?: "low" | "medium" | "high" | undefined;
  max_tokens?: number;
};

// LLM Completion function that handles streaming and non-streaming responses
async function getLlmCompletion({
  model,
  modelProvider,
  messages,
  stream = false,
  logger,
  reasoning_effort,
  max_tokens
}: GetLlmCompletionRequest & { logger: import('fastify').FastifyBaseLogger }) {
  logger.info({
    msg: 'Starting LLM completion request',
    provider: modelProvider.providerName,
    model,
    stream
  });

  try {
    const openai = new OpenAI({
      apiKey: modelProvider.apiKey,
      baseURL: modelProvider.baseUrl,
    });

    let response;

    if (reasoning_effort) {
      logger.info({
        reasoning_effort,
        model,
      });

      response = await (openai.chat.completions.create({
        model,
        messages,
        stream,
        reasoning: {
          effort: reasoning_effort,
        },
        max_tokens: max_tokens || undefined
      } as any) as Promise<any>);
      logger.info({
        msg: 'LLM completion response',
        response
      });
    } else {
      response = await openai.chat.completions.create({
        model,
        messages,
        stream,
        max_tokens: max_tokens || undefined
      });
    }

    logger.info({
      msg: 'LLM completion request successful',
      provider: modelProvider.providerName,
      model
    });

    return response;
  } catch (error: any) {
    logger.error({
      msg: "OpenAI SDK completion request failed",
      provider: modelProvider.providerName,
      model,
      error: {
        message: error.message,
        status: error.status,
        type: error.type,
      },
    });
    throw error;
  }
}

// Update liveness check function
async function updateLiveness(machineIp: string, logger: import('fastify').FastifyBaseLogger) {
  const url = `${ROUTER_BASE_URL}/liveness/${machineIp}`;

  setInterval(async () => {
    try {
      await axios.post(url, {}, { headers: { Authorization: `Bearer ${Env.MACHINE_API_TOKEN}` } });
      logger.info(`Liveness check successful for ${machineIp}`);
    } catch (error) {
      const err = error as Error;
      logger.error(`Error in liveness check: ${err.message}`);
    }
  }, 3000);
}

// Root plugin definition
const root: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  // Register startup handler
  fastify.addHook("onReady", async () => {
    const machineIp = Env.MACHINE_IP || getLocalIp(fastify.log);
    fastify.log.info(`Using machine IP: ${machineIp}`);

    fastify.log.info("Starting machine registration process...");

    if (!ROUTER_BASE_URL) {
      fastify.log.error("ROUTER_BASE_URL is not set");
      fastify.log.error("Shutting down...");
      process.exit(1);
    }

    const machineToken = await registerMachine(ROUTER_BASE_URL, fastify.log);

    if (machineToken) {
      fastify.log.info("Machine registered successfully and token acquired");
      process.env.MACHINE_API_TOKEN = machineToken;
      Env.MACHINE_API_TOKEN = machineToken;
      fastify.log.info(`Using machine name: ${Env.MACHINE_NAME}`);

      updateLiveness(machineIp, fastify.log);
    } else {
      fastify.log.error("Failed to register machine or acquire token after multiple attempts");
      fastify.log.error("Machine registration is required to run the service");
      fastify.log.error("Shutting down...");
      process.exit(1);
    }
  });

  fastify.addHook("preHandler", async (request, reply) => {
    reply.header("x-machine-ip", Env.MACHINE_IP || getLocalIp(fastify.log));
  });

  // Health check endpoint
  fastify.get("/health", async (request, reply) => {
    return reply.send({
      status: "ok",
      version: process.env.VERSION || "0.0.0",
    });
  });

  // Chat completions endpoint
  fastify.post<{ Body: AiRequest }>(
    "/v1/chat/completions",
    async (request, reply) => {
      const requestId = request.id;
      const startTime = Date.now();

      const { model, modelProvider, messages, stream = false, max_tokens } = request.body;

      if (!messages || !messages.some((msg) => msg.role === "user")) {
        fastify.log.warn({
          msg: "Invalid request - missing user message",
          requestId,
        });
        reply
          .code(400)
          .send({ error: "At least one user message is required" });
        return;
      }

      try {
        const [provider, modelName] = getModelProvider(model, modelProvider);

        const reasoningEffort: "low" | "medium" | "high" | undefined = request.body.reasoning_effort || undefined;

        const response = await getLlmCompletion({
          model: modelName,
          modelProvider: provider,
          messages,
          stream: !!stream,
          logger: fastify.log,
          reasoning_effort: reasoningEffort,
          max_tokens: max_tokens || undefined
        });

        if (!stream) {
          return { data: response };
        }

        reply.raw.setHeader("x-machine-ip", Env.MACHINE_IP || getLocalIp(fastify.log));
        reply.raw.setHeader("x-machine-name", Env.MACHINE_NAME);
        reply.raw.setHeader("Content-Type", "text/event-stream");
        reply.raw.setHeader("Cache-Control", "no-cache");
        reply.raw.setHeader("Connection", "keep-alive");

        reply.hijack();

        for await (const chunk of response as any) {
          const data = JSON.stringify(chunk);
          reply.raw.write(`data: ${data}\n\n`);
        }

        reply.raw.end();
      } catch (error: any) {
        const duration = Date.now() - startTime;
        fastify.log.error({
          msg: "Chat completion request failed",
          requestId,
          duration,
          error: {
            message: error.message,
            code: error.code,
            stack: error.stack,
            response: error.response
              ? {
                status: error.response.status,
                statusText: error.response.statusText,
                data: error.response.data,
              }
              : undefined,
          },
        });

        const statusCode = error.response?.status || 500;
        const errorMessage =
          error.response?.data?.error?.message ||
          error.message ||
          "Unknown error";

        reply.code(statusCode).send({
          error: errorMessage,
          request_id: requestId,
        });
      }
    }
  );

  // Verification endpoint
  fastify.post<{ Body: VerifyRequest }>(
    "/v1/verify",
    async (request, reply) => {
      const { messages, model, model_provider } = request.body;

      if (!messages || messages.length === 0) {
        return reply.code(400).send({
          error: "At least one message is required"
        });
      }

      // Add system message if not present
      if (!messages.some(msg => msg.role === "system")) {
        messages.unshift({
          role: "system",
          content: `You are a verification assistant. Your task is to verify if the user message is correct or not.
                   Use the provided verify_statement function to respond.
                   Be concise with your reasoning.
                   Always use the function to respond.`
        });
      }

      try {
        const [provider, modelName] = getModelProvider(model, model_provider);


        const openai = new OpenAI({
          apiKey: provider.apiKey,
          baseURL: provider.baseUrl,
        });

        const response = await openai.chat.completions.create({
          model: modelName,
          messages: messages as OpenAI.ChatCompletionMessageParam[],
          stream: false,
          tools: [{
            type: "function",
            function: {
              name: "verify_statement",
              description: "Verify if the user message is correct or not",
              parameters: {
                type: "object",
                properties: {
                  is_correct: {
                    type: "boolean",
                    description: "Whether the statement is correct (true) or incorrect (false)"
                  },
                  reason: {
                    type: "string",
                    description: "Brief explanation for the verification result"
                  }
                },
                required: ["is_correct", "reason"]
              }
            }
          }],
          tool_choice: { type: "function", function: { name: "verify_statement" } },
        }) as OpenAI.ChatCompletion;


        const toolCall = response.choices[0].message.tool_calls?.[0];

        if (toolCall) {
          const args = JSON.parse(toolCall.function.arguments) as VerifyFunctionArgs;
          return {
            result: args.is_correct ? "yes" : "no",
            content: args.reason
          };
        }

        // Fallback to content-based response
        const content = response.choices[0].message.content || "";
        return {
          result: content.trim().toLowerCase() === "yes" ? "yes" : "no",
          content: content
        };

      } catch (error: any) {
        fastify.log.error({
          msg: "Verification request failed",
          error: {
            message: error.message,
            code: error.code,
            stack: error.stack
          }
        });

        const statusCode = error.response?.status || 500;
        const errorMessage = error.response?.data?.error?.message || error.message || "Unknown error";

        return reply.code(statusCode).send({
          error: errorMessage
        });
      }
    }
  );
};

export default root;
