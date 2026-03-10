import { Hono } from "hono";
import type { AppContext } from "../env";
import { authMiddleware } from "../middleware/auth";
import type { GatewayLog, GatewayLogsResponse } from "../types";

export const logsRoutes = new Hono<AppContext>();

logsRoutes.use("*", authMiddleware);

// GET /api-logs - Fetch logs from AI Gateway
logsRoutes.get("/api-logs", async (c) => {
  const user = c.get("user")!;
  const roles = user.roles || [];
  const isAdmin = roles.includes("admin");

  const page = parseInt(c.req.query("page") || "1");
  const perPage = Math.min(parseInt(c.req.query("per_page") || "50"), 100);
  const search = c.req.query("search") || "";
  const startDate = c.req.query("start_date");
  const endDate = c.req.query("end_date");
  const cached = c.req.query("cached");
  const success = c.req.query("success");

  const accountId = c.env.CF_ACCOUNT_ID;
  const gatewayId = c.env.GATEWAY_ID;
  const apiToken = c.env.CF_API_TOKEN;

  if (!accountId || !apiToken) {
    return c.json({ error: "AI Gateway not configured" }, 500);
  }

  // Build query params
  const params = new URLSearchParams({
    page: page.toString(),
    per_page: perPage.toString(),
    order_by: "created_at",
    direction: "desc",
  });

  // For non-admin users, filter by user ID in metadata
  if (!isAdmin) {
    params.set("search", user.id);
  } else if (search) {
    params.set("search", search);
  }

  if (startDate) params.set("start_date", startDate);
  if (endDate) params.set("end_date", endDate);
  if (cached) params.set("cached", cached);
  if (success) params.set("success", success);

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai-gateway/gateways/${gatewayId}/logs?${params}`,
      {
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[logs] AI Gateway API error:", response.status, errorText);
      return c.json({ error: "Failed to fetch logs from AI Gateway" }, 502);
    }

    const data = (await response.json()) as GatewayLogsResponse;

    // For non-admin users, filter results to only show their logs (by metadata.user_id)
    let logs = data.result || [];
    if (!isAdmin) {
      logs = logs.filter((log) => {
        const metadata = log.metadata as Record<string, unknown> | undefined;
        return metadata?.user_id === user.id;
      });
    }

    // Transform to match expected format
    const transformedLogs = logs.map((log) => ({
      id: log.id,
      created_at: log.created_at,
      model: log.model,
      provider: log.provider,
      prompt_tokens: log.tokens_in || 0,
      completion_tokens: log.tokens_out || 0,
      total_tokens: (log.tokens_in || 0) + (log.tokens_out || 0),
      total_response_time: log.duration / 1000,
      success: log.success,
      cached: log.cached,
      cost: log.cost || 0,
      status_code: log.status_code,
      metadata: log.metadata,
    }));

    return c.json({
      logs: transformedLogs,
      total: data.result_info?.total_count || logs.length,
      page,
      per_page: perPage,
      pages: data.result_info ? Math.ceil(data.result_info.total_count / perPage) : 1,
    });
  } catch (error) {
    console.error("[logs] Error fetching logs:", error);
    return c.json({ error: "Failed to fetch logs" }, 500);
  }
});

// GET /api-logs/metrics - Get aggregated metrics from AI Gateway
logsRoutes.get("/api-logs/metrics", async (c) => {
  const user = c.get("user")!;
  const roles = user.roles || [];
  const isAdmin = roles.includes("admin");

  const startDate = c.req.query("start_date");
  const endDate = c.req.query("end_date");

  const accountId = c.env.CF_ACCOUNT_ID;
  const gatewayId = c.env.GATEWAY_ID;
  const apiToken = c.env.CF_API_TOKEN;

  if (!accountId || !apiToken) {
    return c.json({ error: "AI Gateway not configured" }, 500);
  }

  const params = new URLSearchParams({
    per_page: "1000",
    order_by: "created_at",
    direction: "desc",
  });

  if (!isAdmin) {
    params.set("search", user.id);
  }

  if (startDate) params.set("start_date", startDate);
  if (endDate) params.set("end_date", endDate);

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai-gateway/gateways/${gatewayId}/logs?${params}`,
      {
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      return c.json({ error: "Failed to fetch metrics" }, 502);
    }

    const data = (await response.json()) as GatewayLogsResponse;

    let logs = data.result || [];
    if (!isAdmin) {
      logs = logs.filter((log) => {
        const metadata = log.metadata as Record<string, unknown> | undefined;
        return metadata?.user_id === user.id;
      });
    }

    // Calculate metrics
    const totalRequests = logs.length;
    const successfulRequests = logs.filter((l) => l.success).length;
    const cachedRequests = logs.filter((l) => l.cached).length;
    const totalTokensIn = logs.reduce((sum, l) => sum + (l.tokens_in || 0), 0);
    const totalTokensOut = logs.reduce((sum, l) => sum + (l.tokens_out || 0), 0);
    const totalCost = logs.reduce((sum, l) => sum + (l.cost || 0), 0);
    const avgDuration = logs.length > 0 ? logs.reduce((sum, l) => sum + (l.duration || 0), 0) / logs.length : 0;

    // Group by model
    const modelBreakdown: Record<string, { requests: number; tokens: number; cost: number }> = {};
    for (const log of logs) {
      if (!modelBreakdown[log.model]) {
        modelBreakdown[log.model] = { requests: 0, tokens: 0, cost: 0 };
      }
      const entry = modelBreakdown[log.model]!;
      entry.requests++;
      entry.tokens += (log.tokens_in || 0) + (log.tokens_out || 0);
      entry.cost += log.cost || 0;
    }

    return c.json({
      total_requests: totalRequests,
      successful_requests: successfulRequests,
      cached_requests: cachedRequests,
      success_rate: totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 0,
      cache_rate: totalRequests > 0 ? (cachedRequests / totalRequests) * 100 : 0,
      total_tokens_in: totalTokensIn,
      total_tokens_out: totalTokensOut,
      total_tokens: totalTokensIn + totalTokensOut,
      total_cost: totalCost,
      avg_duration_ms: avgDuration,
      model_breakdown: Object.entries(modelBreakdown).map(([model, stats]) => ({
        model,
        ...stats,
      })),
    });
  } catch (error) {
    console.error("[logs] Error fetching metrics:", error);
    return c.json({ error: "Failed to fetch metrics" }, 500);
  }
});

// GET /total-inference-calls - Get total request count
logsRoutes.get("/total-inference-calls", async (c) => {
  const user = c.get("user")!;
  const roles = user.roles || [];
  const isAdmin = roles.includes("admin");

  const accountId = c.env.CF_ACCOUNT_ID;
  const gatewayId = c.env.GATEWAY_ID;
  const apiToken = c.env.CF_API_TOKEN;

  if (!accountId || !apiToken) {
    return c.json({ error: "AI Gateway not configured" }, 500);
  }

  const params = new URLSearchParams({
    per_page: "1",
  });

  if (!isAdmin) {
    params.set("search", user.id);
  }

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai-gateway/gateways/${gatewayId}/logs?${params}`,
      {
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      return c.json({ error: "Failed to fetch total calls" }, 502);
    }

    const data = (await response.json()) as GatewayLogsResponse;

    // For non-admin, we need to fetch more and count
    // This is a limitation - for accurate counts we'd need to fetch all
    // For now, return the total_count from result_info (which is gateway-wide for admin)
    // and estimate for users
    if (!isAdmin) {
      // Fetch up to 1000 to count user's logs
      const countParams = new URLSearchParams({
        per_page: "1000",
        search: user.id,
      });

      const countResponse = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai-gateway/gateways/${gatewayId}/logs?${countParams}`,
        {
          headers: {
            Authorization: `Bearer ${apiToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (countResponse.ok) {
        const countData = (await countResponse.json()) as GatewayLogsResponse;
        const userLogs = (countData.result || []).filter((log) => {
          const metadata = log.metadata as Record<string, unknown> | undefined;
          return metadata?.user_id === user.id;
        });
        return c.json({ total: userLogs.length });
      }
    }

    return c.json({
      total: data.result_info?.total_count || 0,
    });
  } catch (error) {
    console.error("[logs] Error fetching total calls:", error);
    return c.json({ error: "Failed to fetch total calls" }, 500);
  }
});
