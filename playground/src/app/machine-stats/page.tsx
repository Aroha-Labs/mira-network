"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "src/hooks/useSession";
import api from "src/lib/axios";
import {
  ArrowPathIcon,
  ChartBarIcon,
  ClockIcon,
  CurrencyDollarIcon,
  ServerIcon,
  SparklesIcon,
  ArrowTrendingUpIcon,
  ArrowDownTrayIcon,
  CpuChipIcon,
  SignalIcon,
  BoltIcon,
  ChartPieIcon,
  ArrowsRightLeftIcon,
  FireIcon,
} from "@heroicons/react/24/outline";
import Loading from "src/components/PageLoading";
import { useState, useMemo } from "react";
import { USDollar } from "src/utils/currency";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  RadialLinearScale,
} from "chart.js";
import { Line, Bar, Doughnut, Radar } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  RadialLinearScale,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface MachineModel {
  model: string;
  tokens: number;
  cost: number;
  count: number;
}

interface MachineTimeSeries {
  timestamp: string;
  tokens: number;
  cost: number;
  requests: number;
}

interface MachineData {
  machine_id: string;
  total_tokens: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_cost: number;
  avg_response_time: number;
  avg_ttft: number;
  request_count: number;
  models: MachineModel[];
  time_series: MachineTimeSeries[];
}

interface ModelDistribution {
  model: string;
  tokens: number;
  cost: number;
  machine_count: number;
  request_count: number;
}

interface MachineStatsResponse {
  machines: MachineData[];
  model_distribution: ModelDistribution[];
  totals: {
    tokens: number;
    cost: number;
    requests: number;
    machine_count: number;
  };
}

interface Machine {
  id: number;
  network_ip: string;
  status: "online" | "offline";
  name?: string;
  description?: string;
  created_at: string;
  disabled: boolean;
  traffic_weight?: number;
  supported_models?: string[];
}

const fetchMachines = async () => {
  const response = await api.get<Machine[]>("/machines", {
    params: { include_disabled: false },
  });
  return response.data;
};

const fetchMachineStats = async (timeRange: string) => {
  const endDate = new Date();
  const startDate = new Date();

  switch (timeRange) {
    case "1h":
      startDate.setHours(startDate.getHours() - 1);
      break;
    case "6h":
      startDate.setHours(startDate.getHours() - 6);
      break;
    case "24h":
      startDate.setHours(startDate.getHours() - 24);
      break;
    case "7d":
      startDate.setDate(startDate.getDate() - 7);
      break;
    case "30d":
      startDate.setDate(startDate.getDate() - 30);
      break;
  }

  const params = {
    start_date: startDate.toISOString(),
    end_date: endDate.toISOString(),
    interval:
      timeRange === "1h"
        ? "10m"
        : timeRange === "6h"
          ? "30m"
          : timeRange === "24h"
            ? "1h"
            : timeRange === "7d"
              ? "6h"
              : "1d",
  };

  const response = await api.get<MachineStatsResponse>("/machine-stats", { params });
  return response.data;
};

const MachineStatsPage = () => {
  const [timeRange, setTimeRange] = useState("24h");
  const [selectedMetric, setSelectedMetric] = useState<"tokens" | "cost" | "requests">(
    "tokens"
  );
  const { data: userSession } = useSession();

  const { data: machines, isLoading: machinesLoading } = useQuery({
    queryKey: ["machines-for-stats"],
    queryFn: fetchMachines,
    enabled: !!userSession?.access_token,
  });

  const {
    data: statsData,
    isLoading: statsLoading,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["machine-stats", timeRange],
    queryFn: () => fetchMachineStats(timeRange),
    enabled: !!userSession?.access_token,
    refetchInterval: 60000,
  });

  // Prepare machine token usage chart
  const machineTokenChart = useMemo(() => {
    if (!statsData?.machines) return null;

    // Filter out machine_id="0" which represents unknown machines
    const validMachines = statsData.machines.filter((m) => m.machine_id !== "0");
    const topMachines = validMachines.slice(0, 10);
    const machineMap = new Map(machines?.map((m) => [m.id.toString(), m]) || []);

    return {
      labels: topMachines.map((m) => {
        const machine = machineMap.get(m.machine_id);
        return machine?.name || machine?.network_ip || `Machine ${m.machine_id}`;
      }),
      datasets: [
        {
          label: "Total Tokens",
          data: topMachines.map((m) => m.total_tokens),
          backgroundColor: [
            "rgba(59, 130, 246, 0.8)",
            "rgba(16, 185, 129, 0.8)",
            "rgba(245, 158, 11, 0.8)",
            "rgba(239, 68, 68, 0.8)",
            "rgba(139, 92, 246, 0.8)",
            "rgba(236, 72, 153, 0.8)",
            "rgba(14, 165, 233, 0.8)",
            "rgba(168, 85, 247, 0.8)",
            "rgba(251, 146, 60, 0.8)",
            "rgba(34, 197, 94, 0.8)",
          ],
          borderWidth: 0,
        },
      ],
    };
  }, [statsData, machines]);

  // Prepare cost breakdown chart
  const costBreakdownChart = useMemo(() => {
    if (!statsData?.machines) return null;

    // Filter out machine_id="0" which represents unknown machines
    const validMachines = statsData.machines.filter((m) => m.machine_id !== "0");
    const topMachinesByCost = [...validMachines]
      .sort((a, b) => b.total_cost - a.total_cost)
      .slice(0, 5);

    const machineMap = new Map(machines?.map((m) => [m.id.toString(), m]) || []);

    return {
      labels: topMachinesByCost.map((m) => {
        const machine = machineMap.get(m.machine_id);
        return machine?.name || machine?.network_ip || `Machine ${m.machine_id}`;
      }),
      datasets: [
        {
          data: topMachinesByCost.map((m) => m.total_cost),
          backgroundColor: ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6"],
          borderWidth: 0,
        },
      ],
    };
  }, [statsData, machines]);

  // Prepare performance comparison radar chart
  const performanceRadarChart = useMemo(() => {
    if (!statsData?.machines || statsData.machines.length === 0) return null;

    // Filter out machine_id="0" which represents unknown machines
    const validMachines = statsData.machines.filter((m) => m.machine_id !== "0");
    if (validMachines.length === 0) return null;

    const topMachines = validMachines.slice(0, 5);
    const machineMap = new Map(machines?.map((m) => [m.id.toString(), m]) || []);

    // Normalize values for better visualization
    const maxTokens = Math.max(...topMachines.map((m) => m.total_tokens));
    const maxRequests = Math.max(...topMachines.map((m) => m.request_count));
    const maxResponseTime = Math.max(...topMachines.map((m) => m.avg_response_time));
    const maxCost = Math.max(...topMachines.map((m) => m.total_cost));
    const maxTTFT = Math.max(...topMachines.map((m) => m.avg_ttft));

    return {
      labels: ["Tokens", "Requests", "Speed", "Cost Efficiency", "TTFT"],
      datasets: topMachines.map((machine, index) => {
        const machineInfo = machineMap.get(machine.machine_id);
        const colors = [
          "rgba(59, 130, 246",
          "rgba(16, 185, 129",
          "rgba(245, 158, 11",
          "rgba(239, 68, 68",
          "rgba(139, 92, 246",
        ];

        return {
          label:
            machineInfo?.name ||
            machineInfo?.network_ip ||
            `Machine ${machine.machine_id}`,
          data: [
            (machine.total_tokens / maxTokens) * 100,
            (machine.request_count / maxRequests) * 100,
            maxResponseTime > 0
              ? ((maxResponseTime - machine.avg_response_time) / maxResponseTime) * 100
              : 0,
            maxCost > 0 ? ((maxCost - machine.total_cost) / maxCost) * 100 : 0,
            maxTTFT > 0 ? ((maxTTFT - machine.avg_ttft) / maxTTFT) * 100 : 0,
          ],
          backgroundColor: `${colors[index]}, 0.2)`,
          borderColor: `${colors[index]}, 1)`,
          borderWidth: 2,
          pointBackgroundColor: `${colors[index]}, 1)`,
        };
      }),
    };
  }, [statsData, machines]);

  // Prepare time series chart
  const timeSeriesChart = useMemo(() => {
    if (!statsData?.machines || statsData.machines.length === 0) return null;

    // Filter out machine_id="0" which represents unknown machines
    const validMachines = statsData.machines.filter((m) => m.machine_id !== "0");
    if (validMachines.length === 0) return null;

    const topMachines = validMachines.slice(0, 5);
    const machineMap = new Map(machines?.map((m) => [m.id.toString(), m]) || []);

    // Get all unique timestamps
    const allTimestamps = new Set<string>();
    topMachines.forEach((m) => {
      m.time_series.forEach((ts) => allTimestamps.add(ts.timestamp));
    });
    const timestamps = Array.from(allTimestamps).sort();

    const colors = [
      "rgba(59, 130, 246",
      "rgba(16, 185, 129",
      "rgba(245, 158, 11",
      "rgba(239, 68, 68",
      "rgba(139, 92, 246",
    ];

    return {
      labels: timestamps.map((ts) =>
        new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      ),
      datasets: topMachines.map((machine, index) => {
        const machineInfo = machineMap.get(machine.machine_id);
        const dataMap = new Map(
          machine.time_series.map((ts) => [
            ts.timestamp,
            selectedMetric === "tokens"
              ? ts.tokens
              : selectedMetric === "cost"
                ? ts.cost
                : ts.requests,
          ])
        );

        return {
          label:
            machineInfo?.name ||
            machineInfo?.network_ip ||
            `Machine ${machine.machine_id}`,
          data: timestamps.map((ts) => dataMap.get(ts) || 0),
          borderColor: `${colors[index]}, 1)`,
          backgroundColor: `${colors[index]}, 0.1)`,
          tension: 0.4,
          fill: true,
        };
      }),
    };
  }, [statsData, machines, selectedMetric]);

  // Export functionality
  const exportData = (format: "json" | "csv") => {
    if (!statsData) return;

    if (format === "json") {
      const dataStr = JSON.stringify(statsData, null, 2);
      const dataUri =
        "data:application/json;charset=utf-8," + encodeURIComponent(dataStr);
      const exportFileDefaultName = `machine-stats-${new Date().toISOString()}.json`;

      const linkElement = document.createElement("a");
      linkElement.setAttribute("href", dataUri);
      linkElement.setAttribute("download", exportFileDefaultName);
      linkElement.click();
    } else if (format === "csv") {
      // Create CSV
      const headers = [
        "Machine ID",
        "Machine Name",
        "Total Tokens",
        "Total Cost",
        "Requests",
        "Avg Response Time",
        "Avg TTFT",
      ];
      const machineMap = new Map(machines?.map((m) => [m.id.toString(), m]) || []);

      const rows = statsData.machines.map((m) => {
        const machine = machineMap.get(m.machine_id);
        return [
          m.machine_id,
          machine?.name || "Unknown",
          m.total_tokens,
          m.total_cost,
          m.request_count,
          m.avg_response_time,
          m.avg_ttft,
        ];
      });

      const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join(
        "\n"
      );

      const dataUri = "data:text/csv;charset=utf-8," + encodeURIComponent(csvContent);
      const exportFileDefaultName = `machine-stats-${new Date().toISOString()}.csv`;

      const linkElement = document.createElement("a");
      linkElement.setAttribute("href", dataUri);
      linkElement.setAttribute("download", exportFileDefaultName);
      linkElement.click();
    }
  };

  if (!userSession?.access_token) {
    return (
      <div className="flex justify-center items-center h-64">
        Please log in to view machine statistics.
      </div>
    );
  }

  if (machinesLoading || statsLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loading />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="px-4 py-6 mx-auto max-w-7xl sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="flex gap-3 items-center text-3xl font-bold text-gray-900">
                <ServerIcon className="w-8 h-8 text-blue-600" />
                Machine Intelligence Analytics
              </h1>
              <p className="mt-2 text-gray-600">
                Real-time machine performance and token usage analytics
              </p>
            </div>
            <div className="flex gap-2 items-center">
              <button
                onClick={() => exportData("json")}
                className="flex gap-2 items-center px-3 py-2 text-sm text-gray-700 bg-white rounded-lg border border-gray-200 shadow-sm transition-all hover:bg-gray-50"
                title="Export as JSON"
              >
                <ArrowDownTrayIcon className="w-4 h-4" />
                JSON
              </button>
              <button
                onClick={() => exportData("csv")}
                className="flex gap-2 items-center px-3 py-2 text-sm text-gray-700 bg-white rounded-lg border border-gray-200 shadow-sm transition-all hover:bg-gray-50"
                title="Export as CSV"
              >
                <ArrowDownTrayIcon className="w-4 h-4" />
                CSV
              </button>
              <button
                onClick={() => refetch()}
                disabled={isFetching}
                className="p-2 text-gray-500 rounded-lg border border-gray-200 shadow-sm transition-all hover:text-gray-700 hover:bg-white"
                title="Refresh"
              >
                <ArrowPathIcon
                  className={`w-5 h-5 ${isFetching ? "animate-spin" : ""}`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Time Range Selector */}
        <div className="p-4 mb-6 bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="flex justify-between items-center">
            <div className="flex gap-3 items-center">
              <ClockIcon className="w-5 h-5 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Time Range</span>
            </div>
            <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
              {["1h", "6h", "24h", "7d", "30d"].map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                    timeRange === range
                      ? "bg-white text-blue-600 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Key Metrics Dashboard */}
        <div className="grid grid-cols-1 gap-4 mb-8 md:grid-cols-2 lg:grid-cols-4">
          <div className="p-6 bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <div className="p-3 bg-purple-100 rounded-lg">
                <BoltIcon className="w-6 h-6 text-purple-600" />
              </div>
              <ArrowTrendingUpIcon className="w-5 h-5 text-green-500" />
            </div>
            <h3 className="mb-1 text-sm text-gray-600">Total Tokens</h3>
            <p className="text-3xl font-bold text-gray-900">
              {((statsData?.totals.tokens || 0) / 1000000).toFixed(2)}M
            </p>
          </div>

          <div className="p-6 bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <CurrencyDollarIcon className="w-6 h-6 text-green-600" />
              </div>
              <SparklesIcon className="w-5 h-5 text-yellow-500" />
            </div>
            <h3 className="mb-1 text-sm text-gray-600">Total Cost</h3>
            <p className="text-3xl font-bold text-gray-900">
              {USDollar.format(statsData?.totals.cost || 0)}
            </p>
          </div>

          <div className="p-6 bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <div className="p-3 bg-orange-100 rounded-lg">
                <ChartBarIcon className="w-6 h-6 text-orange-600" />
              </div>
              <SignalIcon className="w-5 h-5 text-blue-500" />
            </div>
            <h3 className="mb-1 text-sm text-gray-600">Total Requests</h3>
            <p className="text-3xl font-bold text-gray-900">
              {(statsData?.totals.requests || 0).toLocaleString()}
            </p>
          </div>

          <div className="p-6 bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <div className="p-3 bg-red-100 rounded-lg">
                <FireIcon className="w-6 h-6 text-red-600" />
              </div>
              <div className="px-2 py-1 text-xs font-medium text-green-600 bg-green-100 rounded-full">
                Optimal
              </div>
            </div>
            <h3 className="mb-1 text-sm text-gray-600">Efficiency</h3>
            <p className="text-3xl font-bold text-gray-900">
              {statsData?.totals.requests && statsData?.totals.tokens
                ? Math.round(statsData.totals.tokens / statsData.totals.requests)
                : 0}
              <span className="text-sm font-normal text-gray-500"> tokens/req</span>
            </p>
          </div>
        </div>

        {/* Main Charts Section */}
        <div className="grid grid-cols-1 gap-6 mb-8 lg:grid-cols-2">
          {/* Machine Token Usage */}
          <div className="p-6 bg-white rounded-xl border border-gray-200 shadow-sm">
            <h3 className="flex gap-2 items-center mb-6 text-lg font-semibold text-gray-900">
              <CpuChipIcon className="w-5 h-5 text-blue-600" />
              Token Usage by Machine
            </h3>
            {machineTokenChart ? (
              <div style={{ height: "350px", position: "relative" }}>
                <Bar
                  data={machineTokenChart}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    indexAxis: "y",
                    plugins: {
                      legend: { display: false },
                      tooltip: {
                        callbacks: {
                          label: (context) => {
                            const tokens = context.parsed.x;
                            return `Tokens: ${(tokens / 1000).toFixed(1)}k`;
                          },
                        },
                      },
                    },
                    scales: {
                      x: {
                        ticks: {
                          callback: (value) => `${(Number(value) / 1000).toFixed(0)}k`,
                        },
                        grid: {
                          display: true,
                          color: "rgba(0, 0, 0, 0.05)",
                        },
                      },
                      y: {
                        grid: { display: false },
                      },
                    },
                  }}
                />
              </div>
            ) : (
              <div className="flex justify-center items-center h-64 text-gray-500">
                No data available
              </div>
            )}
          </div>

          {/* Cost Breakdown */}
          <div className="p-6 bg-white rounded-xl border border-gray-200 shadow-sm">
            <h3 className="flex gap-2 items-center mb-6 text-lg font-semibold text-gray-900">
              <ChartPieIcon className="w-5 h-5 text-green-600" />
              Cost Distribution
            </h3>
            {costBreakdownChart ? (
              <div style={{ height: "350px", position: "relative" }}>
                <Doughnut
                  data={costBreakdownChart}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: "bottom",
                        labels: {
                          padding: 15,
                          usePointStyle: true,
                          font: { size: 11 },
                        },
                      },
                      tooltip: {
                        callbacks: {
                          label: (context) => {
                            const cost = context.parsed;
                            const total = context.dataset.data.reduce(
                              (a: number, b: number) => a + b,
                              0
                            );
                            const percentage = ((cost / total) * 100).toFixed(1);
                            return `${context.label}: ${USDollar.format(cost)} (${percentage}%)`;
                          },
                        },
                      },
                    },
                  }}
                />
              </div>
            ) : (
              <div className="flex justify-center items-center h-64 text-gray-500">
                No data available
              </div>
            )}
          </div>
        </div>

        {/* Performance and Time Series */}
        <div className="grid grid-cols-1 gap-6 mb-8 lg:grid-cols-3">
          {/* Performance Radar */}
          <div className="p-6 bg-white rounded-xl border border-gray-200 shadow-sm">
            <h3 className="flex gap-2 items-center mb-6 text-lg font-semibold text-gray-900">
              <ArrowsRightLeftIcon className="w-5 h-5 text-purple-600" />
              Performance Comparison
            </h3>
            {performanceRadarChart ? (
              <div style={{ height: "300px", position: "relative" }}>
                <Radar
                  data={performanceRadarChart}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: "bottom",
                        labels: {
                          padding: 10,
                          usePointStyle: true,
                          font: { size: 10 },
                        },
                      },
                    },
                    scales: {
                      r: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                          stepSize: 25,
                          display: false,
                        },
                        grid: {
                          color: "rgba(0, 0, 0, 0.05)",
                        },
                      },
                    },
                  }}
                />
              </div>
            ) : (
              <div className="flex justify-center items-center h-64 text-gray-500">
                No data available
              </div>
            )}
          </div>

          {/* Time Series */}
          <div className="p-6 bg-white rounded-xl border border-gray-200 shadow-sm lg:col-span-2">
            <div className="flex justify-between items-center mb-6">
              <h3 className="flex gap-2 items-center text-lg font-semibold text-gray-900">
                <ChartBarIcon className="w-5 h-5 text-orange-600" />
                Usage Timeline
              </h3>
              <select
                value={selectedMetric}
                onChange={(e) =>
                  setSelectedMetric(e.target.value as "tokens" | "cost" | "requests")
                }
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="tokens">Tokens</option>
                <option value="cost">Cost</option>
                <option value="requests">Requests</option>
              </select>
            </div>
            {timeSeriesChart ? (
              <div style={{ height: "300px", position: "relative" }}>
                <Line
                  data={timeSeriesChart}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: "bottom",
                        labels: {
                          padding: 15,
                          usePointStyle: true,
                          font: { size: 11 },
                        },
                      },
                      tooltip: {
                        mode: "index",
                        intersect: false,
                        callbacks: {
                          label: (context) => {
                            const value = context.parsed.y;
                            const label = context.dataset.label;
                            if (selectedMetric === "tokens") {
                              return `${label}: ${(value / 1000).toFixed(1)}k tokens`;
                            } else if (selectedMetric === "cost") {
                              return `${label}: ${USDollar.format(value)}`;
                            } else {
                              return `${label}: ${value} requests`;
                            }
                          },
                        },
                      },
                    },
                    scales: {
                      y: {
                        beginAtZero: true,
                        ticks: {
                          callback: (value) => {
                            if (selectedMetric === "tokens") {
                              return `${(Number(value) / 1000).toFixed(0)}k`;
                            } else if (selectedMetric === "cost") {
                              return `$${Number(value).toFixed(0)}`;
                            } else {
                              return value;
                            }
                          },
                          font: { size: 11 },
                        },
                        grid: {
                          display: true,
                          color: "rgba(0, 0, 0, 0.05)",
                        },
                      },
                      x: {
                        ticks: {
                          maxRotation: 45,
                          minRotation: 45,
                          font: { size: 10 },
                        },
                        grid: {
                          display: false,
                        },
                      },
                    },
                  }}
                />
              </div>
            ) : (
              <div className="flex justify-center items-center h-64 text-gray-500">
                No data available
              </div>
            )}
          </div>
        </div>

        {/* Model Distribution */}
        <div className="overflow-hidden bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="flex gap-2 items-center text-lg font-semibold text-gray-900">
              <SparklesIcon className="w-5 h-5 text-yellow-500" />
              Model Distribution Across Machines
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                    Model
                  </th>
                  <th className="px-6 py-3 text-xs font-medium tracking-wider text-right text-gray-500 uppercase">
                    Tokens
                  </th>
                  <th className="px-6 py-3 text-xs font-medium tracking-wider text-right text-gray-500 uppercase">
                    Cost
                  </th>
                  <th className="px-6 py-3 text-xs font-medium tracking-wider text-right text-gray-500 uppercase">
                    Requests
                  </th>
                  <th className="px-6 py-3 text-xs font-medium tracking-wider text-right text-gray-500 uppercase">
                    Machines
                  </th>
                  <th className="px-6 py-3 text-xs font-medium tracking-wider text-center text-gray-500 uppercase">
                    Usage
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {statsData?.model_distribution.map((model) => {
                  const percentage =
                    statsData.totals.tokens > 0
                      ? (model.tokens / statsData.totals.tokens) * 100
                      : 0;

                  return (
                    <tr key={model.model} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {model.model}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-900 whitespace-nowrap">
                        {model.tokens > 1000000
                          ? `${(model.tokens / 1000000).toFixed(2)}M`
                          : model.tokens > 1000
                            ? `${(model.tokens / 1000).toFixed(1)}k`
                            : model.tokens}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-900 whitespace-nowrap">
                        {USDollar.format(model.cost)}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-900 whitespace-nowrap">
                        {model.request_count.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-900 whitespace-nowrap">
                        {model.machine_count}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex gap-2 items-center">
                          <div className="flex-1 h-2 bg-gray-200 rounded-full">
                            <div
                              className="h-2 bg-blue-500 rounded-full"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          <span className="w-12 text-xs text-right text-gray-500">
                            {percentage.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MachineStatsPage;
