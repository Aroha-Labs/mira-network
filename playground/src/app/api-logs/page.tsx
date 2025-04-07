"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "src/hooks/useSession";
import { useState } from "react";
import Modal from "src/components/Modal";
import { ApiLog, ApiLogsResponse } from "src/types/api-log";
import TableLoadingRow from "src/components/TableLoadingRow";
import { Machine, ModelsResponse } from "src/types/machine";
import api from "src/lib/axios";
import {
  ChartBarIcon,
  CalendarIcon,
  ClockIcon,
  TableCellsIcon,
  Squares2X2Icon,
} from "@heroicons/react/24/outline";
import MetricsModal from "src/components/MetricsModal";
import { format } from "date-fns";
import { useStore } from "@tanstack/react-store";
import { userRolesState } from "src/state/userRolesState";

const fetchApiLogs = async (
  page: number = 1,
  pageSize: number = 100,
  startDate?: string,
  endDate?: string,
  machineId?: string,
  model?: string,
  orderBy: string = "created_at",
  order: string = "desc",
  userId?: string
): Promise<ApiLogsResponse> => {
  const response = await api.get(`/api-logs`, {
    params: {
      page,
      page_size: pageSize,
      start_date: startDate,
      end_date: endDate,
      machine_id: machineId,
      model,
      order_by: orderBy,
      order,
      user_id: userId,
    },
  });
  return response.data;
};

const ApiLogsPage = () => {
  const { data: userSession } = useSession();
  const [page, setPage] = useState(1);
  const [pageSize] = useState(100);
  const [startDate, setStartDate] = useState<string | undefined>(undefined);
  const [endDate, setEndDate] = useState<string | undefined>(undefined);
  const [machineId, setMachineId] = useState<string>("");
  const [modelFilter, setModelFilter] = useState<string>("");
  const [orderBy, setOrderBy] = useState<string>("created_at");
  const [order, setOrder] = useState<string>("desc");
  const [showMetrics, setShowMetrics] = useState(false);
  const [viewMode, setViewMode] = useState<"table" | "card">("table");
  const [showOnlyMyLogs, setShowOnlyMyLogs] = useState(true);

  const userRoles = useStore(userRolesState, (state) => state);
  const isAdmin = userRoles.includes("admin");

  const { data, error, isLoading } = useQuery({
    queryKey: [
      "apiLogs",
      page,
      startDate,
      endDate,
      machineId,
      modelFilter,
      orderBy,
      order,
      showOnlyMyLogs,
    ],
    queryFn: () =>
      fetchApiLogs(
        page,
        pageSize,
        startDate,
        endDate,
        machineId,
        modelFilter,
        orderBy,
        order,
        showOnlyMyLogs ? userSession?.user?.id : undefined
      ),
    enabled: !!userSession?.access_token,
  });

  const { data: machines = [] } = useQuery<Machine[]>({
    queryKey: ["machines"],
    queryFn: async () => {
      const response = await api.get(`/machines`);
      return response.data;
    },
    enabled: !!userSession?.access_token,
  });

  const { data: models } = useQuery<ModelsResponse>({
    queryKey: ["models"],
    queryFn: async () => {
      const response = await api.get(`/v1/models`);
      return response.data;
    },
    enabled: !!userSession?.access_token,
  });

  const [selectedLog, setSelectedLog] = useState<ApiLog | null>(null);
  const [activeTab, setActiveTab] = useState<"messages" | "raw">("messages");

  const handleRowClick = (log: ApiLog) => {
    setSelectedLog(log);
  };

  const handleCloseModal = () => {
    setSelectedLog(null);
  };

  const handleNextPage = () => {
    if (data && page < Math.ceil(data.total / pageSize)) {
      setPage(page + 1);
    }
  };

  const handlePreviousPage = () => {
    if (page > 1) {
      setPage(page - 1);
    }
  };

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setStartDate(e.target.value);
  };

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEndDate(e.target.value);
  };

  const handleOrderByChange = (field: string) => {
    if (orderBy === field) {
      setOrder(order === "asc" ? "desc" : "asc");
    } else {
      setOrderBy(field);
      setOrder("asc");
    }
  };

  if (error) {
    return <div>Error loading API logs</div>;
  }

  return (
    <div className="container p-6 mx-auto space-y-6">
      {/* Header with Metrics Button */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">API Logs</h1>
          <p className="mt-1 text-sm text-gray-500">
            View and analyze API usage across your application
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="bg-white rounded-md border border-gray-300 p-0.5 flex items-center">
            <button
              onClick={() => setViewMode("table")}
              className={`p-1.5 rounded-sm ${
                viewMode === "table"
                  ? "bg-gray-100 text-gray-900"
                  : "text-gray-500 hover:text-gray-700"
              }`}
              title="Table view"
            >
              <TableCellsIcon className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode("card")}
              className={`p-1.5 rounded-sm ${
                viewMode === "card"
                  ? "bg-gray-100 text-gray-900"
                  : "text-gray-500 hover:text-gray-700"
              }`}
              title="Card view"
            >
              <Squares2X2Icon className="w-5 h-5" />
            </button>
          </div>
          <button
            onClick={() => setShowMetrics(true)}
            className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-xs hover:bg-gray-50 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <ChartBarIcon className="h-4 w-4 mr-1.5" />
            View Metrics
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-xs">
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-sm font-medium text-gray-700">Filters</h3>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-12">
            {isAdmin && (
              <div className="lg:col-span-12">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showOnlyMyLogs}
                    onChange={(e) => setShowOnlyMyLogs(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-100 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                  <span className="ms-3 text-sm font-medium text-gray-700">
                    Show only my logs
                  </span>
                </label>
              </div>
            )}

            <div className="lg:col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Model
              </label>
              <select
                value={modelFilter}
                onChange={(e) => setModelFilter(e.target.value)}
                className="block w-full rounded-md border-gray-300 text-sm focus:border-blue-500 focus:ring-blue-500 bg-white transition-colors"
              >
                <option value="">All Models</option>
                {models?.data.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.id}
                  </option>
                ))}
              </select>
            </div>

            <div className="lg:col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Node
              </label>
              <select
                value={machineId}
                onChange={(e) => setMachineId(e.target.value)}
                className="block w-full rounded-md border-gray-300 text-sm focus:border-blue-500 focus:ring-blue-500 bg-white transition-colors"
              >
                <option value="">All Nodes</option>
                {machines.map((machine) => (
                  <option key={machine.id} value={machine.id}>
                    {machine.name} {machine.status === "offline" ? "(Offline)" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="lg:col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Start Date
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={startDate || ""}
                  onChange={handleStartDateChange}
                  className="block w-full rounded-md border-gray-300 text-sm focus:border-blue-500 focus:ring-blue-500 bg-white pr-10 transition-colors"
                />
                <CalendarIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              </div>
            </div>

            <div className="lg:col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                End Date
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={endDate || ""}
                  onChange={handleEndDateChange}
                  className="block w-full rounded-md border-gray-300 text-sm focus:border-blue-500 focus:ring-blue-500 bg-white pr-10 transition-colors"
                />
                <CalendarIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      {viewMode === "table" ? (
        <div className="overflow-hidden bg-white border border-gray-200 rounded-lg shadow-xs">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr className="bg-gray-50">
                  {[
                    { key: "created_at", label: "Timestamp", sortable: true },
                    { key: "total_tokens", label: "Tokens", sortable: true },
                    { key: "ttfs", label: "TTFS", sortable: true },
                    {
                      key: "total_response_time",
                      label: "Response Time",
                      sortable: true,
                    },
                    { key: "machine_id", label: "Node", sortable: true },
                    { key: "model", label: "Model", sortable: true },
                    { key: "cost", label: "Cost", sortable: false },
                  ].map((column) => (
                    <th
                      key={column.key}
                      onClick={() =>
                        column.sortable ? handleOrderByChange(column.key) : undefined
                      }
                      className={`px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${
                        column.sortable ? "cursor-pointer hover:bg-gray-100" : ""
                      }`}
                    >
                      <div className="flex items-center gap-1">
                        {column.label}
                        {column.sortable && orderBy === column.key && (
                          <span className="text-gray-400">
                            {order === "asc" ? "▲" : "▼"}
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {isLoading
                  ? Array(5)
                      .fill(0)
                      .map((_, i) => <TableLoadingRow key={i} />)
                  : data?.logs?.map((log) => (
                      <tr
                        key={log.id}
                        onClick={() => handleRowClick(log)}
                        className="cursor-pointer hover:bg-gray-50"
                      >
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {format(new Date(log.created_at), "MMM d, HH:mm")}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {log.total_tokens}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {log.ttft ? log.ttft.toFixed(2) : "N/A"}s
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {log.total_response_time.toFixed(2)}s
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {log.machine_id || "N/A"}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">{log.model}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {log.model_pricing
                            ? (
                                log.prompt_tokens * log.model_pricing.prompt_token +
                                log.completion_tokens * log.model_pricing.completion_token
                              ).toFixed(4)
                            : "N/A"}
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Existing card view */}
          {isLoading ? (
            // Loading state
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {Array(6)
                .fill(0)
                .map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="p-4 bg-white border border-gray-200 rounded-lg">
                      <div className="w-1/4 h-4 mb-4 bg-gray-200 rounded-sm"></div>
                      <div className="space-y-3">
                        <div className="w-3/4 h-4 bg-gray-200 rounded-sm"></div>
                        <div className="w-1/2 h-4 bg-gray-200 rounded-sm"></div>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {data?.logs?.map((log) => (
                  <div
                    key={log.id}
                    onClick={() => handleRowClick(log)}
                    className="overflow-hidden transition-shadow duration-200 bg-white border border-gray-200 rounded-lg cursor-pointer hover:shadow-md"
                  >
                    <div className="p-4">
                      {/* Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-1 text-xs font-medium text-blue-700 rounded-md bg-blue-50">
                            {log.model}
                          </span>
                          <span className="flex items-center gap-1 text-xs text-gray-500">
                            <ClockIcon className="h-3.5 w-3.5" />
                            {log.total_response_time.toFixed(2)}s
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <CalendarIcon className="h-3.5 w-3.5" />
                          {format(new Date(log.created_at), "MMM d, HH:mm")}
                        </div>
                      </div>

                      {/* Content Preview */}
                      <div className="space-y-2">
                        {/* Tokens & Cost */}
                        <div className="flex gap-3 text-sm">
                          <div className="flex-1 p-2 rounded-md bg-gray-50">
                            <div className="text-xs text-gray-500">Tokens</div>
                            <div className="font-medium">{log.total_tokens}</div>
                          </div>
                          {log.model_pricing && (
                            <div className="flex-1 p-2 rounded-md bg-gray-50">
                              <div className="text-xs text-gray-500">Cost</div>
                              <div className="font-medium">
                                $
                                {(
                                  log.prompt_tokens * log.model_pricing.prompt_token +
                                  log.completion_tokens *
                                    log.model_pricing.completion_token
                                ).toFixed(4)}
                              </div>
                            </div>
                          )}
                          {log.ttft && (
                            <div className="flex-1 p-2 rounded-md bg-gray-50">
                              <div className="text-xs text-gray-500">TTFT</div>
                              <div className="font-medium">{log.ttft.toFixed(2)}s</div>
                            </div>
                          )}
                        </div>

                        {/* Preview */}
                        <div className="text-sm text-gray-600 line-clamp-2">
                          {log.response}
                        </div>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="px-4 py-2 border-t border-gray-100 bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-gray-500">
                          Node: {log.machine_id || "N/A"}
                        </div>
                        <div className="text-xs text-blue-600 hover:text-blue-800">
                          View Details →
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Pagination */}
      <div className="p-4 mt-4 bg-white border border-gray-200 rounded-lg shadow-xs">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-500">
            Showing page {page} of {data ? Math.ceil(data.total / pageSize) : "..."}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handlePreviousPage}
              disabled={page === 1}
              className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={handleNextPage}
              disabled={data && page >= Math.ceil(data.total / pageSize)}
              className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Modal */}
      {showMetrics && (
        <MetricsModal
          onClose={() => setShowMetrics(false)}
          title="API Logs Metrics"
          machineId={machineId ? Number(machineId) : undefined}
          modelFilter={modelFilter || undefined}
          dateRange={{
            startDate,
            endDate,
          }}
        />
      )}

      {/* Log Details Modal */}
      {selectedLog && (
        <Modal onClose={handleCloseModal} title="API Log Details" maxWidth="sm:max-w-7xl">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 gap-3 mb-4 text-sm sm:grid-cols-3">
            <div className="px-3 py-2 rounded-md bg-gray-50">
              <div className="text-gray-500">Model</div>
              <div className="font-medium truncate">{selectedLog.model}</div>
            </div>
            <div className="px-3 py-2 rounded-md bg-gray-50">
              <div className="text-gray-500">Tokens</div>
              <div className="font-medium">{selectedLog.total_tokens}</div>
            </div>
            <div className="px-3 py-2 rounded-md bg-gray-50">
              <div className="text-gray-500">Response Time</div>
              <div className="font-medium">
                {selectedLog.total_response_time.toFixed(2)}s
              </div>
            </div>
            {selectedLog.ttft && (
              <div className="px-3 py-2 rounded-md bg-gray-50">
                <div className="text-gray-500">TTFT</div>
                <div className="font-medium">{selectedLog.ttft.toFixed(2)}s</div>
              </div>
            )}
            <div className="px-3 py-2 rounded-md bg-gray-50">
              <div className="text-gray-500">Node</div>
              <div className="font-medium truncate">{selectedLog.machine_id || "-"}</div>
            </div>
          </div>

          {/* Tabs */}
          <div className="px-6 -mx-6 border-b border-gray-200">
            <nav className="flex space-x-4">
              <button
                onClick={() => setActiveTab("messages")}
                className={`${
                  activeTab === "messages"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm`}
              >
                Messages
              </button>
              <button
                onClick={() => setActiveTab("raw")}
                className={`${
                  activeTab === "raw"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm`}
              >
                Raw Request
              </button>
            </nav>
          </div>

          {/* Content */}
          <div className="mt-4 space-y-3">
            {activeTab === "messages" ? (
              <>
                {selectedLog.payload?.messages.map(
                  (message: { role: string; content: string }, index: number) => (
                    <div
                      key={index}
                      className={`p-3 rounded-md ${
                        message.role === "user"
                          ? "bg-blue-50 border border-blue-100"
                          : "bg-gray-50 border border-gray-100"
                      }`}
                    >
                      <div className="flex items-center mb-1">
                        <span
                          className={`text-xs font-medium px-1.5 py-0.5 rounded-sm ${
                            message.role === "user"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-gray-200 text-gray-700"
                          }`}
                        >
                          {message.role}
                        </span>
                      </div>
                      <div className="text-sm whitespace-pre-wrap">{message.content}</div>
                    </div>
                  )
                )}
                <div className="p-3 border border-green-100 rounded-md bg-green-50">
                  <div className="flex items-center mb-1">
                    <span className="text-xs font-medium px-1.5 py-0.5 rounded-sm bg-green-100 text-green-700">
                      assistant
                    </span>
                  </div>
                  <div className="text-sm whitespace-pre-wrap">
                    {selectedLog.response}
                  </div>
                </div>
              </>
            ) : (
              <pre className="p-3 overflow-x-auto text-sm border border-gray-200 rounded-md bg-gray-50">
                {JSON.stringify(selectedLog.payload, null, 2)}
              </pre>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};

export default ApiLogsPage;
