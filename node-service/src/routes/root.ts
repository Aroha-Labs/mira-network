import { FastifyPluginAsync } from "fastify";
import axios from "axios";
import { Env } from "../config";
import { registerMachine, getLocalIp } from "../utils/machineRegistry";
import OpenAI from "openai";

import pino from "pino";
const logger = pino({
  level: process.env.LOG_LEVEL || 'error',
  timestamp: true,
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
  serializers: {
    error: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res
  }
});

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
};

// LLM Completion function that handles streaming and non-streaming responses
async function getLlmCompletion({
  model,
  modelProvider,
  messages,
  stream = false,
}: GetLlmCompletionRequest) {
  // const startTime = Date.now();
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

    const response = await openai.chat.completions.create({
      model,
      messages,
      stream,
    });

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
async function updateLiveness(machineIp: string) {
  const url = `${ROUTER_BASE_URL}/liveness/${machineIp}`;
  
  // Ensure token is available before trying to use it
  if (!Env.MACHINE_API_TOKEN) {
    logger.error("Attempted to start liveness check without MACHINE_API_TOKEN. Registration likely failed or is incomplete.");
    // Consider exiting or other failure strategy if liveness is critical
    return; 
  }
  const headers = { Authorization: `Bearer ${Env.MACHINE_API_TOKEN}` };

  // Initial immediate check (optional, consider if needed)
  // try {
  //   await axios.post(url, {}, { headers });
  //   logger.info(`Initial liveness check successful for ${machineIp}`);
  // } catch (error) {
  //   const err = error as Error;
  //   logger.error(`Error in initial liveness check: ${err.message}`);
  // }

  // Start periodic checks
  setInterval(async () => {
    // Re-check token in case it becomes unset somehow (unlikely but safe)
    if (!Env.MACHINE_API_TOKEN) {
      logger.warn("MACHINE_API_TOKEN not set, skipping liveness check.");
      return; 
    }
    try {
      await axios.post(url, {}, { headers });
      logger.info(`Periodic liveness check successful for ${machineIp}`);
    } catch (error) {
      const err = error as Error;
      logger.error(`Error in periodic liveness check: ${err.message}`);
    }
  }, 30000); // 30s interval
}

// Root plugin definition
const root: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  // Register startup handler
  fastify.addHook("onReady", async () => {
    // Get the machine IP from environment or determine the local IP
    const machineIp = Env.MACHINE_IP || getLocalIp();
    fastify.log.info(`Using machine IP: ${machineIp}`);

    // Register the machine with the router and get an API token
    fastify.log.info("Starting machine registration process (blocking startup)...");

    if (!ROUTER_BASE_URL) {
      fastify.log.error("ROUTER_BASE_URL is not set");
      fastify.log.error("Shutting down...");
      process.exit(1); // Exit if router URL is missing
    }

    const startTime = Date.now();
    try {
      const machineToken = await registerMachine(ROUTER_BASE_URL);
      const duration = Date.now() - startTime;
      logger.info(`Machine registration process took ${duration}ms`);

      if (machineToken) {
        fastify.log.info("Machine registered successfully and token acquired");
        process.env.MACHINE_API_TOKEN = machineToken;
        Env.MACHINE_API_TOKEN = machineToken; // Update Env class as well
        fastify.log.info(`Using machine name: ${Env.MACHINE_NAME}`);

        // Start the liveness update task only after successful registration
        updateLiveness(machineIp);
      } else {
        // registerMachine already logs errors, just log the consequence here
        logger.error("Failed to register machine or acquire token. Shutting down...");
        process.exit(1); // Exit if registration fails
      }
    } catch (error) {
      // Catch unexpected errors during the registration call itself
      const duration = Date.now() - startTime;
      logger.error({
        msg: "Unhandled error during machine registration process",
        duration,
        error,
      });
      logger.error("Shutting down due to unexpected registration error...");
      process.exit(1); // Exit on unexpected error during registration
    }
  });

  fastify.addHook("preHandler", async (request, reply) => {
    // Add headers - these will only be added once the server starts listening
    reply.header("x-machine-ip", Env.MACHINE_IP || getLocalIp());
    if (Env.MACHINE_NAME) {
      reply.header("x-machine-name", Env.MACHINE_NAME);
    }
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

      const { model, modelProvider, messages, stream = false } = request.body;

      if (!messages || !messages.some((msg) => msg.role === "user")) {
        logger.warn({
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

        const response = await getLlmCompletion({
          model: modelName,
          modelProvider: provider,
          messages,
          stream: !!stream,
        });

        // Handle non-streaming response
        if (!stream) {
          return { data: response };
        }

        // Handle streaming response
        reply.raw.setHeader("x-machine-ip", Env.MACHINE_IP || getLocalIp());
        reply.raw.setHeader("x-machine-name", Env.MACHINE_NAME);
        reply.raw.setHeader("Content-Type", "text/event-stream");
        reply.raw.setHeader("Cache-Control", "no-cache");
        reply.raw.setHeader("Connection", "keep-alive");

        // Use reply.hijack() to prevent Fastify from managing the response
        reply.hijack();

        // Stream the chunks
        for await (const chunk of response as any) {
          const data = JSON.stringify(chunk);
          reply.raw.write(`data: ${data}\n\n`);
        }

        reply.raw.end();
      } catch (error: any) {
        const duration = Date.now() - startTime;
        logger.error({
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
};

export default root;
