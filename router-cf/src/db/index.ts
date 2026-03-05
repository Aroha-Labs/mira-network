import { drizzle } from "drizzle-orm/d1";
import * as usersSchema from "./schema/users";
import * as appSchema from "./schema/app";
import * as billingSchema from "./schema/billing";

export function createUsersDb(d1: D1Database) {
  return drizzle(d1, { schema: usersSchema });
}

export function createAppDb(d1: D1Database) {
  return drizzle(d1, { schema: appSchema });
}

export function createBillingDb(d1: D1Database) {
  return drizzle(d1, { schema: billingSchema });
}

export type UsersDb = ReturnType<typeof createUsersDb>;
export type AppDb = ReturnType<typeof createAppDb>;
export type BillingDb = ReturnType<typeof createBillingDb>;

export * from "./schema";
