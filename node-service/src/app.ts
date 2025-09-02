import { FastifyPluginAsync } from "fastify";
import fastifyEnv from "@fastify/env";
import fastifySensible from "@fastify/sensible";
import { envSchema } from "./config/env.schema";
import rootRoute from "./routes/root";

const app: FastifyPluginAsync = async (fastify): Promise<void> => {
  // Register environment configuration with validation
  await fastify.register(fastifyEnv, {
    schema: envSchema,
    dotenv: true, // Load from .env file if present
    data: process.env, // Also use existing env vars
  });

  // Register sensible plugin for better error handling
  await fastify.register(fastifySensible);

  // Register routes
  await fastify.register(rootRoute);
};

export default app;