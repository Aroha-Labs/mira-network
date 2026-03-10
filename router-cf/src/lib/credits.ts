import { createBillingDb, creditHistory } from "../db";
import type { ModelInfo } from "./models";

const CREDITS_CACHE_TTL = 60; // 1 minute cache for reads

interface Env {
  KV: KVNamespace;
  BILLING_DB: D1Database;
  CREDITS_DO: DurableObjectNamespace;
}

interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens?: number;
}

// Get the DO stub for a user (returns stub with RPC methods)
function getCreditsStub(env: Env, userId: string) {
  const id = env.CREDITS_DO.idFromName(userId);
  return env.CREDITS_DO.get(id) as DurableObjectStub & {
    getBalance(): Promise<number>;
    setBalance(amount: number): Promise<number>;
    addCredits(amount: number): Promise<number>;
    deductCredits(amount: number): Promise<{ success: boolean; balance: number }>;
  };
}

/**
 * Calculate cost from token usage and model pricing
 */
export function calculateCost(modelInfo: ModelInfo, usage: TokenUsage): number {
  return (
    (usage.prompt_tokens / 1000) * modelInfo.promptTokenPrice +
    (usage.completion_tokens / 1000) * modelInfo.completionTokenPrice
  );
}

/**
 * Get user's current credit balance (KV cache first, then DO)
 */
export async function getUserCredits(env: Env, userId: string): Promise<number> {
  // Try KV cache first
  const cached = await env.KV.get(`credits:${userId}`);
  if (cached !== null) {
    return parseFloat(cached);
  }

  // Cache miss - get from DO
  const stub = getCreditsStub(env, userId);
  const balance = await stub.getBalance();

  // Update cache
  await env.KV.put(`credits:${userId}`, balance.toString(), {
    expirationTtl: CREDITS_CACHE_TTL,
  });

  return balance;
}

/**
 * Check if user has enough credits (fast KV check)
 */
export async function hasEnoughCredits(env: Env, userId: string, amount: number): Promise<boolean> {
  const balance = await getUserCredits(env, userId);
  return balance >= amount;
}

/**
 * Atomic deduct credits via DO and log to history
 */
export async function deductCredits(
  env: Env,
  userId: string,
  cost: number,
  modelId: string,
  usage: TokenUsage
): Promise<{ success: boolean; previousBalance: number; newBalance: number }> {
  if (cost <= 0) {
    const balance = await getUserCredits(env, userId);
    return { success: true, previousBalance: balance, newBalance: balance };
  }

  // Get current balance for logging
  const previousBalance = await getUserCredits(env, userId);

  // Atomic deduct via DO
  const stub = getCreditsStub(env, userId);
  const result = await stub.deductCredits(cost);

  // Update KV cache
  await env.KV.put(`credits:${userId}`, result.balance.toString(), {
    expirationTtl: CREDITS_CACHE_TTL,
  });

  if (!result.success) {
    console.log("[credits] Insufficient:", { userId, cost: cost.toFixed(6), balance: result.balance.toFixed(6) });
    return { success: false, previousBalance, newBalance: result.balance };
  }

  // Log to credit history
  const billingDb = createBillingDb(env.BILLING_DB);
  await billingDb.insert(creditHistory).values({
    id: crypto.randomUUID(),
    userId,
    amount: -cost,
    description: `AI usage: ${modelId} (${usage.prompt_tokens}+${usage.completion_tokens} tokens)`,
    createdAt: new Date().toISOString(),
  });

  console.log("[credits] Deducted:", {
    userId,
    cost: cost.toFixed(6),
    previousBalance: previousBalance.toFixed(6),
    newBalance: result.balance.toFixed(6),
  });

  return { success: true, previousBalance, newBalance: result.balance };
}

/**
 * Add credits to user (admin use)
 */
export async function addCredits(
  env: Env,
  userId: string,
  amount: number,
  description?: string
): Promise<{ previousBalance: number; newBalance: number }> {
  const previousBalance = await getUserCredits(env, userId);

  // Add via DO
  const stub = getCreditsStub(env, userId);
  const newBalance = await stub.addCredits(amount);

  // Update KV cache
  await env.KV.put(`credits:${userId}`, newBalance.toString(), {
    expirationTtl: CREDITS_CACHE_TTL,
  });

  // Log to credit history
  const billingDb = createBillingDb(env.BILLING_DB);
  await billingDb.insert(creditHistory).values({
    id: crypto.randomUUID(),
    userId,
    amount,
    description: description || "Admin credit adjustment",
    createdAt: new Date().toISOString(),
  });

  return { previousBalance, newBalance };
}

/**
 * Set user's credit balance (admin use)
 */
export async function setCredits(env: Env, userId: string, amount: number): Promise<number> {
  const stub = getCreditsStub(env, userId);
  const newBalance = await stub.setBalance(amount);

  // Update KV cache
  await env.KV.put(`credits:${userId}`, newBalance.toString(), {
    expirationTtl: CREDITS_CACHE_TTL,
  });

  return newBalance;
}

/**
 * Estimate tokens from text (rough approximation: ~4 chars per token)
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// Note: Usage logging handled by AI Gateway
