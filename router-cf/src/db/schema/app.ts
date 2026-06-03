import { sqliteTable, text, index } from "drizzle-orm/sqlite-core";

export const flows = sqliteTable(
  "flows",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    systemPrompt: text("system_prompt").notNull(),
    variables: text("variables"),
    createdAt: text("created_at").default("(datetime('now'))"),
    updatedAt: text("updated_at").default("(datetime('now'))"),
  },
  (table) => [index("idx_flows_user_id").on(table.userId)]
);

export const verificationResults = sqliteTable(
  "verification_results",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    requestId: text("request_id").notNull(),
    originalFact: text("original_fact").notNull(),
    domain: text("domain").notNull().default("general"),
    url: text("url"),
    minRequired: text("min_required"),
    results: text("results").notNull(), // JSON: ClaimResult[]
    tokenUsage: text("token_usage"), // JSON: per-model usage
    createdAt: text("created_at").default("(datetime('now'))"),
  },
  (table) => [
    index("idx_verification_results_user_id").on(table.userId),
    index("idx_verification_results_created_at").on(table.createdAt),
  ]
);

export const settings = sqliteTable("settings", {
  name: text("name").primaryKey(),
  value: text("value").notNull(),
  description: text("description"),
  updatedAt: text("updated_at").default("(datetime('now'))"),
});
