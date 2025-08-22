"use client";

import { useQuery } from "@tanstack/react-query";
import api from "src/lib/axios";
import { ArrowPathIcon, ChartBarIcon } from "@heroicons/react/24/outline";
import { useState, useMemo } from "react";
import { USDollar } from "src/utils/currency";

interface ModelUsage {
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  avg_response_time: number;
  avg_ttft: number;
  total_cost: number;
}

interface UsageBucket {
  timestamp: string;
  models: ModelUsage[];
}

interface UsageStatsResponse {
  results: UsageBucket[];
}

const fetchUsageStats = async (interval: string) => {
  // Get stats for the last 24 hours
  const endDate = new Date();
  const startDate = new Date();
  startDate.setHours(startDate.getHours() - 24);

  const response = await api.get<UsageStatsResponse>("/usage-stats", {
    params: {
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
      interval: interval,
    },
  });
  return response.data;
};

export default function UsageStats() {
  const [interval, setInterval] = useState("1h");
  
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["usage-stats", interval],
    queryFn: () => fetchUsageStats(interval),
    refetchInterval: 60000, // Refresh every minute
  });

  // Calculate totals
  const totals = useMemo(() => {
    if (!data?.results) return null;

    let totalTokens = 0;
    let totalCost = 0;
    let totalRequests = 0;
    const modelUsage: Record<string, { tokens: number; cost: number; count: number }> = {};

    data.results.forEach(bucket => {
      bucket.models.forEach(model => {
        totalTokens += model.total_tokens;
        totalCost += model.total_cost;
        totalRequests += 1;

        if (!modelUsage[model.model]) {
          modelUsage[model.model] = { tokens: 0, cost: 0, count: 0 };
        }
        modelUsage[model.model].tokens += model.total_tokens;
        modelUsage[model.model].cost += model.total_cost;
        modelUsage[model.model].count += 1;
      });
    });

    // Get top 3 models by usage
    const topModels = Object.entries(modelUsage)
      .sort((a, b) => b[1].tokens - a[1].tokens)
      .slice(0, 3);

    return {
      totalTokens,
      totalCost,
      totalRequests,
      topModels,
      modelUsage,
    };
  }, [data]);

  if (isLoading) {
    return (
      <div className="w-full max-w-md p-4 bg-white rounded-sm shadow-sm">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-3"></div>
          <div className="space-y-2">
            <div className="h-3 bg-gray-200 rounded"></div>
            <div className="h-3 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <div className="bg-white rounded-sm shadow-sm border border-gray-200">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ChartBarIcon className="w-5 h-5 text-gray-600" />
              <h3 className="text-sm font-medium text-gray-900">Usage Statistics (24h)</h3>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={interval}
                onChange={(e) => setInterval(e.target.value)}
                className="text-xs border-gray-300 rounded px-2 py-1"
              >
                <option value="10m">10 min</option>
                <option value="30m">30 min</option>
                <option value="1h">1 hour</option>
                <option value="3h">3 hours</option>
              </select>
              <button
                onClick={() => refetch()}
                disabled={isFetching}
                className="p-1 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-50 transition-colors"
                title="Refresh"
              >
                <ArrowPathIcon className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="p-4">
          {totals ? (
            <>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-xl font-bold text-gray-900">
                    {totals.totalRequests}
                  </div>
                  <div className="text-xs text-gray-500">Requests</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-blue-600">
                    {(totals.totalTokens / 1000).toFixed(1)}k
                  </div>
                  <div className="text-xs text-gray-500">Tokens</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-green-600">
                    {USDollar.format(totals.totalCost)}
                  </div>
                  <div className="text-xs text-gray-500">Cost</div>
                </div>
              </div>

              {/* Top Models */}
              {totals.topModels.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-medium text-gray-700">Top Models</div>
                  {totals.topModels.map(([model, usage]) => {
                    const percentage = totals.totalTokens > 0 
                      ? (usage.tokens / totals.totalTokens) * 100 
                      : 0;
                    return (
                      <div key={model} className="flex items-center gap-2">
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-gray-600 truncate max-w-[150px]">
                              {model}
                            </span>
                            <span className="text-xs text-gray-500">
                              {percentage.toFixed(0)}%
                            </span>
                          </div>
                          <div className="bg-gray-200 rounded-full h-1.5">
                            <div
                              className="bg-blue-500 h-1.5 rounded-full transition-all"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                        <div className="text-xs text-gray-500 text-right min-w-[60px]">
                          {(usage.tokens / 1000).toFixed(1)}k
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Activity Sparkline */}
              {data?.results && data.results.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="text-xs font-medium text-gray-700 mb-2">Activity Timeline</div>
                  <div className="flex items-end gap-0.5 h-12">
                    {data.results.slice(-20).map((bucket, i) => {
                      const bucketTokens = bucket.models.reduce((sum, m) => sum + m.total_tokens, 0);
                      const maxTokens = Math.max(...data.results.map(b => 
                        b.models.reduce((sum, m) => sum + m.total_tokens, 0)
                      ));
                      const height = maxTokens > 0 ? (bucketTokens / maxTokens) * 100 : 0;
                      
                      return (
                        <div
                          key={i}
                          className="flex-1 bg-blue-400 rounded-t hover:bg-blue-500 transition-colors"
                          style={{ height: `${height}%`, minHeight: '2px' }}
                          title={`${new Date(bucket.timestamp).toLocaleTimeString()}: ${bucketTokens} tokens`}
                        />
                      );
                    })}
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-xs text-gray-400">
                      {data.results.length > 0 
                        ? new Date(data.results[0].timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : ''}
                    </span>
                    <span className="text-xs text-gray-400">
                      {data.results.length > 0 
                        ? new Date(data.results[data.results.length - 1].timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : ''}
                    </span>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-gray-500">No usage data available</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}