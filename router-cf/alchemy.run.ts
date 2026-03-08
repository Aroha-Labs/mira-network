import alchemy from "alchemy";
import { Worker, D1Database, KVNamespace, AiGateway, Ai, DurableObjectNamespace } from "alchemy/cloudflare";

const app = await alchemy("mira-router", {
  stage: process.env.STAGE ?? "dev",
});

// D1 Databases with migrations
const usersDb = await D1Database("mira-users-db", {
  migrationsDir: "./drizzle/users",
});
const appDb = await D1Database("mira-app-db", {
  migrationsDir: "./drizzle/app",
});
const billingDb = await D1Database("mira-billing-db", {
  migrationsDir: "./drizzle/billing",
});

// KV Namespace
const kv = await KVNamespace("mira-kv");

// Durable Object for credits (atomic operations, no race conditions)
const creditsDO = DurableObjectNamespace("credits", {
  className: "CreditsDO",
  sqlite: true,
});

// AI Gateway
const gateway = await AiGateway("mira-gateway", {
  collectLogs: true,
  rateLimitingInterval: 60,
  rateLimitingLimit: 1000,
  rateLimitingTechnique: "sliding",
  authentication: true, // Required for cf-aig-authorization header
});

console.log("SUPABASE_SECRET_KEY", process.env.SUPABASE_WEBHOOK_SECRET);

// Worker
export const api = await Worker("mira-api", {
  entrypoint: "./src/index.ts",
  compatibilityDate: "2024-12-01",
  bindings: {
    USERS_DB: usersDb,
    APP_DB: appDb,
    BILLING_DB: billingDb,
    KV: kv,
    CREDITS_DO: creditsDO,
    AI: Ai(),
    GATEWAY_ID: gateway.id,
    CF_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID!,
    CF_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN!,
    SUPABASE_URL: process.env.SUPABASE_URL!,
    SUPABASE_KEY: process.env.SUPABASE_KEY!,
    SUPABASE_WEBHOOK_SECRET: process.env.SUPABASE_WEBHOOK_SECRET || "",
  },
});

console.log(`API deployed: ${api.url}`);

await app.finalize();
