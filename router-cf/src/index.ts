import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import type { AppContext } from "./env";

import { aiRoutes } from "./routes/ai";
import { flowsRoutes } from "./routes/flows";
import { flowCompletionsRoutes } from "./routes/flow-completions";
import { tokensRoutes } from "./routes/tokens";
import { creditsRoutes } from "./routes/credits";
import { adminRoutes } from "./routes/admin/index";
import { webhooksRoutes } from "./routes/webhooks";
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
    origin: "*",
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  })
);

// Health check
app.get("/health", (c) => c.json({ status: "ok" }));

// AI routes - /v1/models, /v1/chat/completions, /v1/verify
app.route("/v1", aiRoutes);

// Flow completions - /v1/flow/:id/chat/completions
app.route("/v1/flow", flowCompletionsRoutes);

// Flows CRUD - /flows
app.route("/flows", flowsRoutes);

// API tokens - /api-tokens
app.route("/api-tokens", tokensRoutes);

// Webhooks - /webhooks/* (no auth, verified by signature) - MUST be before root-mounted routes
app.route("/webhooks", webhooksRoutes);

// Proxy - /proxy-image
app.route("/", proxyRoutes);

// Admin routes - /admin/* (requires admin auth)
app.route("/admin", adminRoutes);

// Credits - /user-credits, /user-credits-history (mounted at root, has auth middleware)
app.route("/", creditsRoutes);

// Logs - /api-logs, /api-logs/metrics, /total-inference-calls (fetches from AI Gateway)
app.route("/", logsRoutes);

export default app;
