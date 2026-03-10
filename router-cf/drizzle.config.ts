import type { Config } from "drizzle-kit";

// Config for users database
export const usersConfig: Config = {
  schema: "./src/db/schema/users.ts",
  out: "./drizzle/users",
  dialect: "sqlite",
};

// Config for app database
export const appConfig: Config = {
  schema: "./src/db/schema/app.ts",
  out: "./drizzle/app",
  dialect: "sqlite",
};

// Config for billing database
export const billingConfig: Config = {
  schema: "./src/db/schema/billing.ts",
  out: "./drizzle/billing",
  dialect: "sqlite",
};

// Default export for drizzle-kit CLI
export default usersConfig;
