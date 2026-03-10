import { sqliteTable, text, real, index } from "drizzle-orm/sqlite-core";

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
