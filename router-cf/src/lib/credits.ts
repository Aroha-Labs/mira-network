import { createBillingDb, creditHistory, usageSummary } from "../db";
import { eq, and, sql } from "drizzle-orm";
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

/**
 * Log usage to daily summary table (aggregated by user/date/model)
 */
export async function logUsage(
  env: CreditEnv,
  userId: string,
  modelId: string,
  usage: TokenUsage,
  cost: number,
  responseTime: number,
  ttft?: number
): Promise<void> {
  const billingDb = createBillingDb(env.BILLING_DB);
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

  // Try to update existing record, or insert new one
  const existing = await billingDb
    .select()
    .from(usageSummary)
    .where(
      and(
        eq(usageSummary.userId, userId),
        eq(usageSummary.date, today),
        eq(usageSummary.model, modelId)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    const record = existing[0]!;
    const newRequestCount = (record.requestCount || 0) + 1;
    const newPromptTokens = (record.promptTokens || 0) + usage.prompt_tokens;
    const newCompletionTokens = (record.completionTokens || 0) + usage.completion_tokens;
    const newTotalCost = (record.totalCost || 0) + cost;
    // Running average for response time
    const newAvgResponseTime =
      ((record.avgResponseTime || 0) * (record.requestCount || 0) + responseTime) / newRequestCount;
    const newAvgTtft = ttft
      ? ((record.avgTtft || 0) * (record.requestCount || 0) + ttft) / newRequestCount
      : record.avgTtft || 0;

    await billingDb
      .update(usageSummary)
      .set({
        requestCount: newRequestCount,
        promptTokens: newPromptTokens,
        completionTokens: newCompletionTokens,
        totalCost: newTotalCost,
        avgResponseTime: newAvgResponseTime,
        avgTtft: newAvgTtft,
      })
      .where(eq(usageSummary.id, record.id));
  } else {
    await billingDb.insert(usageSummary).values({
      id: crypto.randomUUID(),
      userId,
      date: today,
      model: modelId,
      requestCount: 1,
      promptTokens: usage.prompt_tokens,
      completionTokens: usage.completion_tokens,
      totalCost: cost,
      avgResponseTime: responseTime,
      avgTtft: ttft || 0,
      createdAt: new Date().toISOString(),
    });
  }

  console.log("[usage] Logged:", { userId, modelId, date: today, tokens: usage.total_tokens, cost: cost.toFixed(6) });
}
