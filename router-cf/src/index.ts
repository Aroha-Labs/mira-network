import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import type { AppContext } from "./env";
import { createAuth } from "./lib/auth";
import { drizzle } from "drizzle-orm/d1";

import { aiRoutes } from "./routes/ai";
import { flowsRoutes } from "./routes/flows";
import { flowCompletionsRoutes } from "./routes/flow-completions";
import { tokensRoutes } from "./routes/tokens";
import { creditsRoutes } from "./routes/credits";
import { adminRoutes } from "./routes/admin/index";
import { proxyRoutes } from "./routes/proxy";
import { logsRoutes } from "./routes/logs";

// Export Durable Object classes
export { CreditsDO } from "./durable-objects/credits";

const app = new Hono<AppContext>();

// Middleware
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: (origin) => origin || "*", // Allow any origin
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
    exposeHeaders: ["Content-Length", "X-Request-Id"],
    credentials: true,
    maxAge: 86400,
  })
);

// Health check
app.get("/health", (c) => c.json({ status: "ok" }));

// Better Auth handler
app.on(["POST", "GET"], "/api/auth/**", (c) => {
  const auth = createAuth(drizzle(c.env.USERS_DB), {
    BETTER_AUTH_SECRET: c.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: c.env.BETTER_AUTH_URL,
    TRUSTED_ORIGINS: c.env.TRUSTED_ORIGINS,
    GOOGLE_CLIENT_ID: c.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: c.env.GOOGLE_CLIENT_SECRET,
  });
  return auth.handler(c.req.raw);
});

// AI routes - /v1/models, /v1/chat/completions, /v1/verify
app.route("/v1", aiRoutes);

// Flow completions - /v1/flow/:id/chat/completions
app.route("/v1/flow", flowCompletionsRoutes);

// Flows CRUD - /flows
app.route("/flows", flowsRoutes);

// API tokens - /api-tokens
app.route("/api-tokens", tokensRoutes);

// Proxy - /proxy-image
app.route("/", proxyRoutes);

// Admin routes - /admin/* (requires admin auth)
app.route("/admin", adminRoutes);

// Credits - /user-credits, /user-credits-history (mounted at root, has auth middleware)
app.route("/", creditsRoutes);

// Logs - /api-logs, /api-logs/metrics, /total-inference-calls (fetches from AI Gateway)
app.route("/", logsRoutes);

export default app;
