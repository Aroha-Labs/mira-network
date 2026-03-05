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

export const settings = sqliteTable("settings", {
  name: text("name").primaryKey(),
  value: text("value").notNull(),
  description: text("description"),
  updatedAt: text("updated_at").default("(datetime('now'))"),
});
