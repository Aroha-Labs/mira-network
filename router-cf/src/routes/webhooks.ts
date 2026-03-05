import { Hono } from "hono";
import { z } from "zod";
import type { AppContext } from "../env";
import { createUsersDb, users } from "../db";
import { eq } from "drizzle-orm";
import { verifySupabaseWebhook } from "../lib/crypto";

export const webhooksRoutes = new Hono<AppContext>();

// Test endpoint
webhooksRoutes.get("/test", (c) => {
  console.log("[webhook] Test endpoint hit");
  return c.json({ ok: true });
});

// Schema for Supabase user claims webhook
const userClaimWebhookSchema = z.object({
  user_id: z.string(),
  claims: z.record(z.string(), z.unknown()),
});

// POST /admin/user-claims - Supabase webhook for user sync
// This is called by Supabase when users sign up or update their profile
webhooksRoutes.post("/user-claims", async (c) => {
  console.log("[webhook] >>> Handler reached!");

  const webhookSecret = c.env.SUPABASE_WEBHOOK_SECRET;
  let body: string;

  // Get request body
  try {
    body = await c.req.text();
    console.log("[webhook] Body received, length:", body.length);
  } catch (e) {
    console.log("[webhook] Error reading body:", e);
    return c.json({ error: "Failed to read body" }, 400);
  }

  // Log headers for debugging
  console.log("[webhook] Headers:", JSON.stringify({
    authorization: c.req.header("Authorization"),
    webhookId: c.req.header("webhook-id"),
    webhookTimestamp: c.req.header("webhook-timestamp"),
    webhookSignature: c.req.header("webhook-signature")?.slice(0, 30) + "...",
  }));

  // Verify webhook signature if secret is configured (Svix format)
  if (webhookSecret) {
    const isValid = await verifySupabaseWebhook(body, {
      webhookId: c.req.header("webhook-id"),
      webhookTimestamp: c.req.header("webhook-timestamp"),
      webhookSignature: c.req.header("webhook-signature"),
    }, webhookSecret);

    if (!isValid) {
      return c.json({ error: "Invalid webhook signature" }, 401);
    }
  }

  // Parse and validate body
  const parsed = userClaimWebhookSchema.safeParse(JSON.parse(body));
  if (!parsed.success) {
    return c.json({ error: "Invalid request body" }, 400);
  }

  const { user_id, claims } = parsed.data;

  // Extract user metadata from claims
  const userMetadata = (claims.user_metadata || {}) as Record<string, unknown>;
  const appMetadata = (claims.app_metadata || {}) as Record<string, unknown>;

  const email = (userMetadata.email as string) || (claims.email as string) || "";
  const fullName = (userMetadata.full_name as string) || (userMetadata.name as string) || null;
  const avatarUrl = (userMetadata.avatar_url as string) || null;
  const provider = (appMetadata.provider as string) || (userMetadata.provider as string) || null;

  const usersDb = createUsersDb(c.env.USERS_DB);
  const now = new Date().toISOString();

  // Check if user exists
  const existing = await usersDb.select().from(users).where(eq(users.id, user_id)).limit(1);

  if (existing.length > 0) {
    // Update existing user
    await usersDb
      .update(users)
      .set({
        email,
        fullName,
        avatarUrl,
        provider,
        updatedAt: now,
      })
      .where(eq(users.id, user_id));
  } else {
    // Create new user
    await usersDb.insert(users).values({
      id: user_id,
      email,
      fullName,
      avatarUrl,
      provider,
      roles: '["user"]',
      createdAt: now,
      updatedAt: now,
    });

    // Initialize credits for new user
    await c.env.KV.put(`credits:${user_id}`, "0");
  }

  // Get user's roles to return in claims
  const user = await usersDb.select().from(users).where(eq(users.id, user_id)).limit(1);
  const userRoles = user[0] ? JSON.parse(user[0].roles || '["user"]') : ["user"];

  // Return updated claims with roles
  const updatedClaims = {
    ...claims,
    user_roles: userRoles,
  };

  return c.json({
    user_id,
    claims: updatedClaims,
  });
});
