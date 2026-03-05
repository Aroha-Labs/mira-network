import { sqliteTable, text, real, integer, index, unique } from "drizzle-orm/sqlite-core";

export const creditHistory = sqliteTable(
  "credit_history",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    amount: real("amount").notNull(),
    description: text("description"),
    createdAt: text("created_at").default("(datetime('now'))"),
  },
  (table) => [
    index("idx_credit_history_user_id").on(table.userId),
    index("idx_credit_history_created_at").on(table.createdAt),
  ]
);

export const usageSummary = sqliteTable(
  "usage_summary",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    date: text("date").notNull(),
    model: text("model").notNull(),
    requestCount: integer("request_count").default(0),
    promptTokens: integer("prompt_tokens").default(0),
    completionTokens: integer("completion_tokens").default(0),
    totalCost: real("total_cost").default(0),
    avgResponseTime: real("avg_response_time").default(0),
    avgTtft: real("avg_ttft").default(0),
    createdAt: text("created_at").default("(datetime('now'))"),
  },
  (table) => [
    index("idx_usage_summary_user_date").on(table.userId, table.date),
    unique("unique_user_date_model").on(table.userId, table.date, table.model),
  ]
);
