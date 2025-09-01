import { FastifyPluginAsync } from "fastify";
import { ProviderFactory, ChatCompletionRequest, CompletionOptions } from "../providers";
import { LivenessService } from "../services/liveness.service";
import { Env } from "../config";
import { getLocalIp } from "../utils/network";
import OpenAI from "openai";

const root: FastifyPluginAsync = async (fastify): Promise<void> => {
  let livenessService: LivenessService;

  // Startup handler
  fastify.addHook("onReady", async () => {
    try {
      livenessService = new LivenessService(fastify.log);
      await livenessService.start();
    } catch (error) {
      fastify.log.error("Failed to start liveness service, shutting down...");
      process.exit(1);
    }
  });

  // Add machine info headers
  fastify.addHook("preHandler", async (request, reply) => {
    reply.header("x-machine-ip", Env.MACHINE_IP || getLocalIp(fastify.log));
    reply.header("x-machine-name", Env.MACHINE_NAME || "");
  });

  // Cleanup on shutdown
  fastify.addHook("onClose", async () => {
    livenessService?.stop();
  });

  // Health check
  fastify.get("/health", async () => ({
    status: "ok",
    version: process.env.VERSION || "0.0.0",
    providers: ProviderFactory.listAvailableProviders(),
  }));

  // Chat completions endpoint
  fastify.post<{ Body: ChatCompletionRequest }>(
    "/v1/chat/completions",
    async (request, reply) => {
      const { model, messages, stream = false, ...options } = request.body;

      // Validate request
      if (!messages?.some((msg) => msg.role === "user")) {
        return reply.code(400).send({
          error: "At least one user message is required",
        });
      }

      try {
        // Get provider and model name
        const { provider, modelName } = ProviderFactory.getProvider(
          model,
          fastify.log
        );

        // Create completion options
        const completionOptions: CompletionOptions = {
          stream,
          ...options,
        };

        // Get completion
        const response = await provider.complete(
          modelName,
          messages,
          completionOptions
        );

        // Handle streaming response
        if (stream) {
          reply.raw.setHeader("Content-Type", "text/event-stream");
          reply.raw.setHeader("Cache-Control", "no-cache");
          reply.raw.setHeader("Connection", "keep-alive");
          reply.hijack();

          for await (const chunk of response as AsyncIterable<OpenAI.ChatCompletionChunk>) {
            reply.raw.write(`data: ${JSON.stringify(chunk)}\n\n`);
          }

          reply.raw.end();
          return;
        }

        // Return non-streaming response
        return response;
      } catch (error: any) {
        fastify.log.error({
          msg: "Chat completion failed",
          error: error.message,
          model,
        });

        const statusCode = error.status || error.response?.status || 500;
        const errorMessage = error.message || "Unknown error";

        return reply.code(statusCode).send({
          error: errorMessage,
          request_id: request.id,
        });
      }
    }
  );
};

export default root;