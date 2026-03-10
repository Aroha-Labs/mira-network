import alchemy from "alchemy";
import { Worker, D1Database, KVNamespace, AiGateway, Ai, DurableObjectNamespace } from "alchemy/cloudflare";

const app = await alchemy("mira-router", {
  stage: process.env.STAGE ?? "dev",
  password: process.env.ALCHEMY_PASSWORD,
});

// D1 Databases with migrations
const usersDb = await D1Database("mira-users-db", {
  migrationsDir: "./drizzle/users",
  adopt: true,
});
const appDb = await D1Database("mira-app-db", {
  migrationsDir: "./drizzle/app",
  adopt: true,
});
const billingDb = await D1Database("mira-billing-db", {
  migrationsDir: "./drizzle/billing",
  adopt: true,
});

// KV Namespace
const kv = await KVNamespace("mira-kv", {
  adopt: true,
});

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

// Worker
export const api = await Worker("mira-api", {
  entrypoint: "./src/index.ts",
  compatibilityDate: "2024-12-01",
  observability: {
    enabled: true,
    head_sampling_rate: 1, // Log all requests
  },
  bindings: {
    USERS_DB: usersDb,
    APP_DB: appDb,
    BILLING_DB: billingDb,
    KV: kv,
    CREDITS_DO: creditsDO,
    AI: Ai(),
    GATEWAY_ID: gateway.id,
    CF_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID!,
    CF_API_TOKEN: alchemy.secret(process.env.CLOUDFLARE_API_TOKEN!),
    SUPABASE_URL: process.env.SUPABASE_URL!,
    SUPABASE_KEY: alchemy.secret(process.env.SUPABASE_KEY!),
    SUPABASE_WEBHOOK_SECRET: alchemy.secret(process.env.SUPABASE_WEBHOOK_SECRET || ""),
  },
  adopt: true,
});

console.log(`API deployed: ${api.url}`);

await app.finalize();
