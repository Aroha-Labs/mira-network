"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "src/hooks/useSession";
import { useState } from "react";
import { ApiLogsResponse, MetricsResponse } from "src/types/api-log";
import TableLoadingRow from "src/components/TableLoadingRow";
import api from "src/lib/axios";
import {
  ChartBarIcon,
  CalendarIcon,
  CheckCircleIcon,
  XCircleIcon,
  BoltIcon,
} from "@heroicons/react/24/outline";
import { format } from "date-fns";

const fetchApiLogs = async (
  page: number = 1,
  perPage: number = 50,
  startDate?: string,
  endDate?: string,
  success?: string
): Promise<ApiLogsResponse> => {
  const params: Record<string, string> = {
    page: page.toString(),
    per_page: perPage.toString(),
  };
  if (startDate) params.start_date = startDate;
  if (endDate) params.end_date = endDate;
  if (success) params.success = success;

  const response = await api.get("/api-logs", { params });
  return response.data;
};

const fetchMetrics = async (
  startDate?: string,
  endDate?: string
): Promise<MetricsResponse> => {
  const params: Record<string, string> = {};
  if (startDate) params.start_date = startDate;
  if (endDate) params.end_date = endDate;

  const response = await api.get("/api-logs/metrics", { params });
  return response.data;
};

const ApiLogsPage = () => {
  const { data: userSession } = useSession();
  const [page, setPage] = useState(1);
  const [perPage] = useState(50);
  const [startDate, setStartDate] = useState<string | undefined>(undefined);
  const [endDate, setEndDate] = useState<string | undefined>(undefined);
  const [successFilter, setSuccessFilter] = useState<string>("");

  const { data, error, isLoading } = useQuery({
    queryKey: ["apiLogs", page, startDate, endDate, successFilter],
    queryFn: () => fetchApiLogs(page, perPage, startDate, endDate, successFilter),
    enabled: !!userSession?.access_token,
  });

  const { data: metrics } = useQuery({
    queryKey: ["apiLogsMetrics", startDate, endDate],
    queryFn: () => fetchMetrics(startDate, endDate),
    enabled: !!userSession?.access_token,
  });

  const handleNextPage = () => {
    if (data && page < data.pages) {
      setPage(page + 1);
    }
  };

  const handlePreviousPage = () => {
    if (page > 1) {
      setPage(page - 1);
    }
  };

  if (error) {
    return (
      <div className="container p-6 mx-auto">
        <div className="p-4 text-red-700 bg-red-100 border border-red-300 rounded-lg">
          Error loading API logs. Please try again later.
        </div>
      </div>
    );
  }

  return (
    <div className="container p-6 mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">API Logs</h1>
        <p className="mt-1 text-sm text-gray-500">
          View your AI API request history and usage metrics
        </p>
      </div>

      {/* Metrics Summary */}
      {metrics && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="p-4 bg-white border border-gray-200 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <ChartBarIcon className="w-4 h-4 text-blue-500" />
              <span className="text-sm text-gray-500">Total Requests</span>
            </div>
            <p className="text-2xl font-semibold">{metrics.total_requests.toLocaleString()}</p>
          </div>
          <div className="p-4 bg-white border border-gray-200 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <BoltIcon className="w-4 h-4 text-purple-500" />
              <span className="text-sm text-gray-500">Total Tokens</span>
            </div>
            <p className="text-2xl font-semibold">{metrics.total_tokens.toLocaleString()}</p>
          </div>
          <div className="p-4 bg-white border border-gray-200 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircleIcon className="w-4 h-4 text-green-500" />
              <span className="text-sm text-gray-500">Success Rate</span>
            </div>
            <p className="text-2xl font-semibold">{metrics.success_rate.toFixed(1)}%</p>
          </div>
          <div className="p-4 bg-white border border-gray-200 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <CalendarIcon className="w-4 h-4 text-orange-500" />
              <span className="text-sm text-gray-500">Avg Duration</span>
            </div>
            <p className="text-2xl font-semibold">{(metrics.avg_duration_ms / 1000).toFixed(2)}s</p>
          </div>
        </div>
      )}

      {/* Model Breakdown */}
      {metrics && metrics.model_breakdown.length > 0 && (
        <div className="p-4 bg-white border border-gray-200 rounded-lg">
          <h3 className="mb-3 text-sm font-medium text-gray-700">Usage by Model</h3>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {metrics.model_breakdown.map((model) => (
              <div key={model.model} className="p-3 rounded-md bg-gray-50">
                <p className="text-sm font-medium text-gray-900 truncate">{model.model}</p>
                <p className="text-xs text-gray-500">
                  {model.requests} requests | {model.tokens.toLocaleString()} tokens
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="p-4 bg-white border border-gray-200 rounded-lg">
        <h3 className="mb-3 text-sm font-medium text-gray-700">Filters</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="block mb-1 text-sm text-gray-600">Start Date</label>
            <input
              type="date"
              value={startDate || ""}
              onChange={(e) => setStartDate(e.target.value || undefined)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block mb-1 text-sm text-gray-600">End Date</label>
            <input
              type="date"
              value={endDate || ""}
              onChange={(e) => setEndDate(e.target.value || undefined)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block mb-1 text-sm text-gray-600">Status</label>
            <select
              value={successFilter}
              onChange={(e) => setSuccessFilter(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
            >
              <option value="">All</option>
              <option value="true">Successful</option>
              <option value="false">Failed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="overflow-hidden bg-white border border-gray-200 rounded-lg">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                  Timestamp
                </th>
                <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                  Model
                </th>
                <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                  Provider
                </th>
                <th className="px-4 py-3 text-xs font-medium tracking-wider text-right text-gray-500 uppercase">
                  Tokens
                </th>
                <th className="px-4 py-3 text-xs font-medium tracking-wider text-right text-gray-500 uppercase">
                  Duration
                </th>
                <th className="px-4 py-3 text-xs font-medium tracking-wider text-center text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-4 py-3 text-xs font-medium tracking-wider text-center text-gray-500 uppercase">
                  Cached
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                Array(5)
                  .fill(0)
                  .map((_, i) => <TableLoadingRow key={i} />)
              ) : data?.logs && data.logs.length > 0 ? (
                data.logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {format(new Date(log.created_at), "MMM d, HH:mm:ss")}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {log.model}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{log.provider}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-500">
                      {log.total_tokens.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-500">
                      {log.total_response_time.toFixed(2)}s
                    </td>
                    <td className="px-4 py-3 text-center">
                      {log.success ? (
                        <CheckCircleIcon className="w-5 h-5 mx-auto text-green-500" />
                      ) : (
                        <XCircleIcon className="w-5 h-5 mx-auto text-red-500" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {log.cached && (
                        <span className="px-2 py-1 text-xs font-medium text-blue-700 bg-blue-100 rounded">
                          Cached
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    No logs found. Make some API requests to see them here.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {data && data.pages > 1 && (
        <div className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg">
          <div className="text-sm text-gray-500">
            Page {page} of {data.pages} ({data.total.toLocaleString()} total logs)
          </div>
          <div className="flex gap-2">
            <button
              onClick={handlePreviousPage}
              disabled={page === 1}
              className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={handleNextPage}
              disabled={page >= data.pages}
              className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApiLogsPage;
