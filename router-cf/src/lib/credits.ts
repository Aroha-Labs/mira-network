import { createBillingDb, creditHistory } from "../db";
import type { ModelInfo } from "./models";

interface CreditEnv {
  KV: KVNamespace;
  BILLING_DB: D1Database;
}

interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens?: number;
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
 * Get user's current credit balance
 */
export async function getUserCredits(env: CreditEnv, userId: string): Promise<number> {
  const creditsStr = await env.KV.get(`credits:${userId}`);
  return creditsStr ? parseFloat(creditsStr) : 0;
}

/**
 * Deduct credits and log to history
 */
export async function deductCredits(
  env: CreditEnv,
  userId: string,
  cost: number,
  modelId: string,
  usage: TokenUsage
): Promise<{ previousBalance: number; newBalance: number }> {
  if (cost <= 0) {
    const balance = await getUserCredits(env, userId);
    return { previousBalance: balance, newBalance: balance };
  }

  // Get current credits
  const currentCredits = await getUserCredits(env, userId);
  const newCredits = Math.max(0, currentCredits - cost);

  // Update credits in KV
  await env.KV.put(`credits:${userId}`, newCredits.toString());

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
    previousBalance: currentCredits.toFixed(6),
    newBalance: newCredits.toFixed(6),
  });

  return { previousBalance: currentCredits, newBalance: newCredits };
}

/**
 * Estimate tokens from text (rough approximation: ~4 chars per token)
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// Note: Usage logging handled by AI Gateway
