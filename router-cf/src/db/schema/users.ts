import { sqliteTable, text, index } from "drizzle-orm/sqlite-core";

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    fullName: text("full_name"),
    avatarUrl: text("avatar_url"),
    provider: text("provider"),
    roles: text("roles").default('["user"]'),
    createdAt: text("created_at").default("(datetime('now'))"),
    updatedAt: text("updated_at").default("(datetime('now'))"),
  },
  (table) => [index("idx_users_email").on(table.email)]
);

export const apiTokens = sqliteTable(
  "api_tokens",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    token: text("token").notNull().unique(),
    description: text("description"),
    metaData: text("meta_data"),
    deletedAt: text("deleted_at"),
    createdAt: text("created_at").default("(datetime('now'))"),
  },
  (table) => [
    index("idx_api_tokens_user_id").on(table.userId),
    index("idx_api_tokens_token").on(table.token),
  ]
);
