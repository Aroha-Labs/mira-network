"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "src/hooks/useSession";
import api from "src/lib/axios";
import {
  ArrowPathIcon,
  ChartBarIcon,
  CurrencyDollarIcon,
  ServerIcon,
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
import { USDollarPrecise } from "src/utils/currency";
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
import { Bar, Doughnut, Radar } from "react-chartjs-2";

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


interface MachineData {
  machine_id: string;
  total_tokens: number;
  total_cost: number;
  request_count: number;
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
    queryKey: ["machine-stats"],
    queryFn: () => fetchMachineStats("24h"),
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

    // Calculate max values across all machines for normalization
    const allMachines = statsData.machines.filter((m) => m.machine_id !== "0");
    const maxTokens = Math.max(...allMachines.map((m) => m.total_tokens), 1);
    const maxRequests = Math.max(...allMachines.map((m) => m.request_count), 1);
    const maxCost = Math.max(...allMachines.map((m) => m.total_cost), 0.01);

    return {
      labels: ["Tokens", "Requests", "Cost"],
      datasets: topMachines.map((machine, index) => {
        const machineInfo = machineMap.get(machine.machine_id);
        const colors = [
          "rgba(59, 130, 246",
          "rgba(16, 185, 129",
          "rgba(245, 158, 11",
          "rgba(239, 68, 68",
          "rgba(139, 92, 246",
        ];

        const tokenPercent = (machine.total_tokens / maxTokens) * 100;
        const requestPercent = (machine.request_count / maxRequests) * 100;
        const costPercent = (machine.total_cost / maxCost) * 100;

        return {
          label:
            machineInfo?.name ||
            machineInfo?.network_ip ||
            `Machine ${machine.machine_id}`,
          data: [tokenPercent, requestPercent, costPercent],
          backgroundColor: `${colors[index]}, 0.2)`,
          borderColor: `${colors[index]}, 1)`,
          borderWidth: 2,
          pointBackgroundColor: `${colors[index]}, 1)`,
        };
      }),
    };
  }, [statsData, machines]);

  // Prepare bar chart for top machines
  const topMachinesChart = useMemo(() => {
    if (!statsData?.machines || statsData.machines.length === 0) return null;

    // Filter out machine_id="0" which represents unknown machines
    const validMachines = statsData.machines.filter((m) => m.machine_id !== "0");
    if (validMachines.length === 0) return null;

    // Sort by selected metric and take top 10
    const sortedMachines = [...validMachines].sort((a, b) => {
      if (selectedMetric === "tokens") return b.total_tokens - a.total_tokens;
      if (selectedMetric === "cost") return b.total_cost - a.total_cost;
      return b.request_count - a.request_count;
    });
    
    const topMachines = sortedMachines.slice(0, 10);
    const machineMap = new Map(machines?.map((m) => [m.id.toString(), m]) || []);

    return {
      labels: topMachines.map((machine) => {
        const machineInfo = machineMap.get(machine.machine_id);
        return (
          machineInfo?.name ||
          machineInfo?.network_ip ||
          `Machine ${machine.machine_id}`
        );
      }),
      datasets: [
        {
          label:
            selectedMetric === "tokens"
              ? "Total Tokens"
              : selectedMetric === "cost"
              ? "Total Cost ($)"
              : "Total Requests",
          data: topMachines.map((machine) => {
            if (selectedMetric === "tokens") return machine.total_tokens;
            if (selectedMetric === "cost") return machine.total_cost;
            return machine.request_count;
          }),
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
          borderColor: "rgba(0, 0, 0, 0.1)",
          borderWidth: 1,
        },
      ],
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
              {(() => {
                const tokens = statsData?.totals.tokens || 0;
                if (tokens === 0) return '0';
                if (tokens < 100) return tokens.toFixed(1);
                if (tokens < 1000) return Math.round(tokens).toString();
                if (tokens < 1000000) return `${(tokens / 1000).toFixed(1)}k`;
                return `${(tokens / 1000000).toFixed(2)}M`;
              })()}
            </p>
          </div>

          <div className="p-6 bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <CurrencyDollarIcon className="w-6 h-6 text-green-600" />
              </div>
              <ArrowTrendingUpIcon className="w-5 h-5 text-green-500" />
            </div>
            <h3 className="mb-1 text-sm text-gray-600">Total Cost</h3>
            <p className="text-3xl font-bold text-gray-900">
              {USDollarPrecise.format(statsData?.totals.cost || 0)}
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

        {/* Machine Details Table */}
        <div className="mb-8">
          <h3 className="flex gap-2 items-center mb-6 text-xl font-semibold text-gray-900">
            <ServerIcon className="w-6 h-6 text-blue-600" />
            Machine Performance Details
          </h3>
          <div className="overflow-hidden bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                      Machine
                    </th>
                    <th className="px-6 py-3 text-xs font-medium tracking-wider text-right text-gray-500 uppercase">
                      Status
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
                      Avg Tokens/Req
                    </th>
                    <th className="px-6 py-3 text-xs font-medium tracking-wider text-center text-gray-500 uppercase">
                      Utilization
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {statsData?.machines
                    .filter((m) => m.machine_id !== "0")
                    .sort((a, b) => b.total_tokens - a.total_tokens)
                    .map((machineData) => {
                      const machine = machines?.find((m) => m.id.toString() === machineData.machine_id);
                      const percentage = statsData.totals.tokens > 0
                        ? (machineData.total_tokens / statsData.totals.tokens) * 100
                        : 0;
                      const avgTokensPerRequest = machineData.request_count > 0
                        ? Math.round(machineData.total_tokens / machineData.request_count)
                        : 0;

                      return (
                        <tr key={machineData.machine_id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="flex-shrink-0 w-10 h-10">
                                <div className="flex justify-center items-center w-10 h-10 bg-blue-100 rounded-full">
                                  <ServerIcon className="w-5 h-5 text-blue-600" />
                                </div>
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-medium text-gray-900">
                                  {machine?.name || `Machine ${machineData.machine_id}`}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {machine?.network_ip || 'Unknown IP'}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-right whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              machine?.status === 'online' 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {machine?.status === 'online' ? '🟢 Online' : '⚫ Offline'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-right text-gray-900 whitespace-nowrap">
                            {(() => {
                              const tokens = machineData.total_tokens;
                              if (tokens === 0) return '0';
                              if (tokens < 1) return tokens.toFixed(3);
                              if (tokens < 10) return tokens.toFixed(2);
                              if (tokens < 100) return tokens.toFixed(1);
                              if (tokens < 1000) return Math.round(tokens).toString();
                              if (tokens < 1000000) return `${(tokens / 1000).toFixed(1)}k`;
                              return `${(tokens / 1000000).toFixed(2)}M`;
                            })()}
                          </td>
                          <td className="px-6 py-4 text-sm text-right text-gray-900 whitespace-nowrap">
                            {USDollarPrecise.format(machineData.total_cost)}
                          </td>
                          <td className="px-6 py-4 text-sm text-right text-gray-900 whitespace-nowrap">
                            {machineData.request_count.toLocaleString()}
                          </td>
                          <td className="px-6 py-4 text-sm text-right text-gray-900 whitespace-nowrap">
                            {avgTokensPerRequest.toLocaleString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex gap-2 items-center">
                              <div className="flex-1 h-2 bg-gray-200 rounded-full">
                                <div
                                  className="h-2 bg-gradient-to-r from-blue-400 to-blue-600 rounded-full"
                                  style={{ width: `${Math.min(percentage, 100)}%` }}
                                />
                              </div>
                              <span className="w-14 text-xs text-right text-gray-500">
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
                            if (tokens === 0) return 'Tokens: 0';
                            if (tokens < 1) return `Tokens: ${tokens.toFixed(3)}`;
                            if (tokens < 10) return `Tokens: ${tokens.toFixed(2)}`;
                            if (tokens < 100) return `Tokens: ${tokens.toFixed(1)}`;
                            if (tokens < 1000) return `Tokens: ${Math.round(tokens)}`;
                            if (tokens < 1000000) return `Tokens: ${(tokens / 1000).toFixed(1)}k`;
                            return `Tokens: ${(tokens / 1000000).toFixed(2)}M`;
                          },
                        },
                      },
                    },
                    scales: {
                      x: {
                        ticks: {
                          callback: (value) => {
                            const num = Number(value);
                            if (num === 0) return '0';
                            if (num < 1) return num.toFixed(2);
                            if (num < 10) return num.toFixed(1);
                            if (num < 1000) return Math.round(num).toString();
                            if (num < 1000000) return `${(num / 1000).toFixed(1)}k`;
                            return `${(num / 1000000).toFixed(2)}M`;
                          },
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
                            return `${context.label}: ${USDollarPrecise.format(cost)} (${percentage}%)`;
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
            {topMachinesChart ? (
              <div style={{ height: "300px", position: "relative" }}>
                <Bar
                  data={topMachinesChart}
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
                              if (value === 0) return `${label}: 0 tokens`;
                              if (value < 1) return `${label}: ${value.toFixed(3)} tokens`;
                              if (value < 10) return `${label}: ${value.toFixed(2)} tokens`;
                              if (value < 100) return `${label}: ${value.toFixed(1)} tokens`;
                              if (value < 1000) return `${label}: ${Math.round(value)} tokens`;
                              if (value < 1000000) return `${label}: ${(value / 1000).toFixed(1)}k tokens`;
                              return `${label}: ${(value / 1000000).toFixed(2)}M tokens`;
                            } else if (selectedMetric === "cost") {
                              return `${label}: ${USDollarPrecise.format(value)}`;
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
                            const num = Number(value);
                            if (selectedMetric === "tokens") {
                              if (num === 0) return '0';
                              if (num < 1) return num.toFixed(2);
                              if (num < 10) return num.toFixed(1);
                              if (num < 1000) return Math.round(num).toString();
                              if (num < 1000000) return `${(num / 1000).toFixed(1)}k`;
                              return `${(num / 1000000).toFixed(2)}M`;
                            } else if (selectedMetric === "cost") {
                              if (num === 0) return '$0.0000';
                              if (num < 0.01) return `$${num.toFixed(4)}`;
                              if (num < 1) return `$${num.toFixed(4)}`;
                              if (num < 10) return `$${num.toFixed(4)}`;
                              if (num < 100) return `$${num.toFixed(2)}`;
                              return `$${num.toFixed(0)}`;
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

      </div>
    </div>
  );
};

export default MachineStatsPage;
