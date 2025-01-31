import { useQuery } from "@tanstack/react-query";
import { ApiLog } from "src/types/api-log";
import { useSession } from "src/hooks/useSession";
import Modal from "./Modal";
import { useState, useMemo, useCallback } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from "chart.js";
import { Line, Bar, Doughnut, Chart } from "react-chartjs-2";
import {
  format,
  startOfHour,
  startOfDay,
  startOfWeek,
  startOfMonth,
  addHours,
  addDays,
  addWeeks,
  addMonths,
  isBefore,
  parseISO,
} from "date-fns";
import api from "src/lib/axios";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

interface MetricsModalProps {
  onClose: () => void;
  title?: string;
  machineId?: string;
  apiKeyId?: number;
  userId?: string;
  modelFilter?: string;
  dateRange?: {
    startDate?: string;
    endDate?: string;
  };
  flowId?: string;
}

const Shimmer = () => <div className="w-full h-full bg-gray-200 rounded animate-pulse" />;

const ValueShimmer = () => <div className="w-16 h-6 bg-gray-200 rounded animate-pulse" />;

const ChartShimmer = () => (
  <div className="w-full h-full rounded-lg animate-pulse bg-gray-200/60" />
);

// Add new types for the metrics response
interface MetricsResponse {
  summary: {
    total_calls: number;
    total_tokens: number;
    avg_response_time: number;
    avg_ttft: number;
    total_cost: number;
  };
  time_series: {
    timestamp: string;
    calls: number;
    prompt_tokens: number;
    completion_tokens: number;
    avg_response_time: number;
    avg_ttft: number;
    prompt_cost: number;
    completion_cost: number;
  }[];
  model_distribution: {
    model: string;
    count: number;
  }[];
}

const MetricsModal = ({
  onClose,
  title,
  machineId,
  apiKeyId,
  userId,
  modelFilter,
  dateRange,
  flowId,
}: MetricsModalProps) => {
  const { data: userSession } = useSession();
  const [dateRangeState, setDateRangeState] = useState("7");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10000; // Adjust based on your needs

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
      },
      scales: {
        x: {
          ticks: {
            maxRotation: 45,
            minRotation: 45,
            autoSkip: true,
            maxTicksLimit: window?.innerWidth < 768 ? 5 : 10,
          },
        },
      },
    }),
    []
  );

  const getStartDate = useCallback(() => {
    const date = new Date();
    switch (dateRangeState) {
      case "1":
        date.setDate(date.getDate() - 1);
        break;
      case "7":
        date.setDate(date.getDate() - 7);
        break;
      case "30":
        date.setDate(date.getDate() - 30);
        break;
      case "90":
        date.setDate(date.getDate() - 90);
        break;
    }
    return date;
  }, [dateRangeState]);

  // Replace the existing query with the new metrics endpoint
  const { data, isLoading, error } = useQuery<MetricsResponse>({
    queryKey: [
      "metrics",
      machineId,
      apiKeyId,
      userId,
      modelFilter,
      dateRange,
      dateRangeState,
    ],
    queryFn: async () => {
      const timeBucket =
        dateRangeState === "1"
          ? "hour"
          : dateRangeState === "7"
            ? "day"
            : dateRangeState === "30"
              ? "week"
              : "month";

      const resp = await api.get("/api-logs/metrics", {
        params: {
          ...(flowId && { flow_id: flowId }),
          ...(machineId && { machine_id: machineId }),
          ...(apiKeyId && { api_key_id: apiKeyId }),
          ...(userId && { user_id: userId }),
          ...(modelFilter && { model: modelFilter }),
          ...(dateRange?.startDate && { start_date: dateRange.startDate }),
          ...(dateRange?.endDate && { end_date: dateRange.endDate }),
          time_bucket: timeBucket,
        },
      });
      return resp.data;
    },
    enabled: !!userSession?.access_token,
  });

  const chartData = useMemo(() => {
    if (!data) return null;

    const labels = data.time_series.map((entry) => {
      const date = parseISO(entry.timestamp);
      switch (dateRangeState) {
        case "1":
          return format(date, "HH:mm");
        case "7":
          return format(date, "EEE, MMM d");
        case "30":
          return `Week ${format(date, "w")}`;
        case "90":
          return format(date, "MMM, yy");
        default:
          return format(date, "MMM d");
      }
    });

    return {
      calls: {
        labels,
        datasets: [
          {
            label: "Number of Calls",
            data: data.time_series.map((entry) => entry.calls),
            backgroundColor: "rgba(99, 102, 241, 0.5)",
          },
        ],
      },
      tokens: {
        labels,
        datasets: [
          {
            type: "bar" as const,
            label: "Completion Tokens",
            data: data.time_series.map((entry) => entry.completion_tokens),
            backgroundColor: "rgba(75, 192, 192, 0.5)",
            stack: "tokens",
            order: 2,
          },
          {
            type: "bar" as const,
            label: "Prompt Tokens",
            data: data.time_series.map((entry) => entry.prompt_tokens),
            backgroundColor: "rgba(54, 162, 235, 0.5)",
            stack: "tokens",
            order: 2,
          },
          {
            type: "line" as const,
            label: "Total Tokens",
            data: data.time_series.map(
              (entry) => entry.prompt_tokens + entry.completion_tokens
            ),
            borderColor: "rgb(234, 179, 8)",
            borderWidth: 2,
            tension: 0.1,
            pointStyle: "circle",
            pointRadius: 4,
            pointHoverRadius: 6,
            order: 1,
          },
        ],
      },
      responseTime: {
        labels,
        datasets: [
          {
            label: "Response Time (ms)",
            data: data.time_series.map((entry) => entry.avg_response_time),
            borderColor: "rgb(255, 99, 132)",
            tension: 0.1,
          },
        ],
      },
      cost: {
        labels,
        datasets: [
          {
            label: "Completion Cost",
            data: data.time_series.map((entry) => entry.completion_cost),
            backgroundColor: "rgba(75, 192, 192, 0.5)",
            stack: "cost",
          },
          {
            label: "Prompt Cost",
            data: data.time_series.map((entry) => entry.prompt_cost),
            backgroundColor: "rgba(54, 162, 235, 0.5)",
            stack: "cost",
          },
        ],
      },
      ttft: {
        labels,
        datasets: [
          {
            label: "Time to First Token (ms)",
            data: data.time_series.map((entry) => entry.avg_ttft),
            borderColor: "rgb(168, 85, 247)",
            tension: 0.1,
          },
        ],
      },
      models: {
        labels: data.model_distribution.map((entry) => entry.model),
        datasets: [
          {
            data: data.model_distribution.map((entry) => entry.count),
            backgroundColor: [
              "rgba(255, 99, 132, 0.5)",
              "rgba(54, 162, 235, 0.5)",
              "rgba(255, 206, 86, 0.5)",
              "rgba(75, 192, 192, 0.5)",
            ],
          },
        ],
      },
    };
  }, [data, dateRangeState]);

  // Update chart options for the tokens chart
  const getChartOptions = useCallback((type: string) => {
    const baseOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: type === "tokens", // Only show legend for tokens chart
          position: "top" as const,
        },
      },
      scales: {
        x: {
          ticks: {
            maxRotation: 45,
            minRotation: 45,
            autoSkip: true,
            maxTicksLimit: window?.innerWidth < 768 ? 5 : 10,
          },
        },
      },
    };

    if (type === "tokens" || type === "cost") {
      return {
        ...baseOptions,
        plugins: {
          legend: {
            display: true,
            position: "top" as const,
          },
        },
        scales: {
          ...baseOptions.scales,
          y: {
            stacked: true,
            title: {
              display: true,
              text: type === "tokens" ? "Number of Tokens" : "Cost ($)",
            },
          },
          x: {
            ...baseOptions.scales.x,
            stacked: true,
          },
        },
      };
    }

    if (type === "tokens") {
      return {
        ...baseOptions,
        plugins: {
          legend: {
            display: true,
            position: "top" as const,
          },
        },
        scales: {
          ...baseOptions.scales,
          y: {
            stacked: false,
            title: {
              display: true,
              text: "Number of Tokens",
            },
          },
          x: {
            ...baseOptions.scales.x,
            stacked: true,
          },
        },
      };
    }

    return baseOptions;
  }, []);

  const renderMetricBlock = (
    title: string,
    value: string | null,
    chart: React.ReactNode,
    isWide?: boolean,
    isLoading?: boolean
  ) => (
    <div
      className={`bg-white rounded-lg shadow-sm border border-gray-100 transition-all duration-200 hover:shadow-md ${
        isWide ? "md:col-span-2" : ""
      }`}
    >
      <div className="px-3 py-2 border-b border-gray-100">
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm font-medium text-gray-700">{title}</h3>
          {isLoading ? (
            <ValueShimmer />
          ) : (
            <p className="text-lg font-semibold text-gray-900">{value}</p>
          )}
        </div>
      </div>
      <div className="p-3">
        <div className="h-40">{isLoading ? <ChartShimmer /> : chart}</div>
      </div>
    </div>
  );

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="space-y-4">
          <div className="bg-white px-2 py-1.5 rounded-lg shadow-sm border border-gray-100 flex justify-end gap-1.5">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="w-12 h-8">
                <Shimmer />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {renderMetricBlock("Cost Distribution", null, null, false, true)}
            {renderMetricBlock("Token Usage", null, null, false, true)}
            {renderMetricBlock("Time to First Token", null, null, false, true)}
            {renderMetricBlock("Avg Response Time", null, null, false, true)}
          </div>

          <div className="bg-white border border-gray-100 rounded-lg shadow-sm">
            <div className="px-3 py-2 border-b border-gray-100">
              <h3 className="text-sm font-medium text-gray-700">Model Distribution</h3>
            </div>
            <div className="p-3">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-7">
                      <Shimmer />
                    </div>
                  ))}
                </div>
                <div className="h-40 sm:col-span-2">
                  <ChartShimmer />
                </div>
              </div>
            </div>
          </div>

          {renderMetricBlock("Total Calls", null, null, true, true)}
        </div>
      );
    }

    if (error) {
      return (
        <div className="px-4 py-3 text-red-700 bg-red-100 border border-red-400 rounded">
          <p className="font-bold">Error loading metrics</p>
          <p>{(error as Error).message}</p>
        </div>
      );
    }

    if (!data) {
      return <div className="text-center text-gray-600">No data available</div>;
    }

    return (
      <div className="space-y-4">
        {/* Date range buttons */}
        <div className="bg-white px-2 py-1.5 rounded-lg shadow-sm border border-gray-100 flex justify-between items-center">
          <div className="text-sm text-gray-500">
            {data.time_series.length ? `${data.time_series.length} total logs` : ""}
          </div>
          <div className="flex gap-1.5 overflow-x-auto">
            {[
              { value: "1", label: "24h" },
              { value: "7", label: "7d" },
              { value: "30", label: "30d" },
              { value: "90", label: "3m" },
            ].map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setDateRangeState(value)}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors duration-200 ${
                  dateRangeState === value
                    ? "bg-blue-500 text-white shadow-sm"
                    : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {renderMetricBlock(
            "Cost Distribution",
            `$${data.summary.total_cost.toFixed(4)}`,
            chartData && <Bar data={chartData.cost} options={getChartOptions("cost")} />
          )}
          {renderMetricBlock(
            "Token Usage",
            data.summary.total_tokens.toLocaleString(),
            chartData && (
              <Chart
                type="bar"
                data={chartData.tokens}
                options={getChartOptions("tokens")}
              />
            )
          )}
          {renderMetricBlock(
            "Time to First Token",
            `${data.summary.avg_ttft.toFixed(2)}ms`,
            chartData && <Line data={chartData.ttft} options={chartOptions} />
          )}
          {renderMetricBlock(
            "Avg Response Time",
            `${data.summary.avg_response_time.toFixed(2)}ms`,
            chartData && <Line data={chartData.responseTime} options={chartOptions} />
          )}
        </div>

        {/* Model Distribution */}
        <div className="transition-all duration-200 bg-white border border-gray-100 rounded-lg shadow-sm hover:shadow-md">
          <div className="px-3 py-2 border-b border-gray-100">
            <h3 className="text-sm font-medium text-gray-700">Model Distribution</h3>
          </div>
          <div className="p-3">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-1.5 text-sm">
                {data.model_distribution.map((entry) => (
                  <div
                    key={entry.model}
                    className="flex items-center justify-between px-2 py-1 rounded bg-gray-50"
                  >
                    <span className="mr-2 text-xs text-gray-600 truncate">
                      {entry.model}
                    </span>
                    <span className="text-xs font-medium text-gray-900">
                      {entry.count} calls
                    </span>
                  </div>
                ))}
              </div>
              <div className="h-40 sm:col-span-2">
                {chartData && (
                  <Doughnut
                    data={chartData.models}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          position: "right",
                          labels: {
                            boxWidth: 10,
                            padding: 15,
                            font: { size: 11 },
                          },
                        },
                      },
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Total Calls */}
        {renderMetricBlock(
          "Total Calls",
          data.summary.total_calls.toString(),
          chartData && <Bar data={chartData.calls} options={chartOptions} />,
          true
        )}
      </div>
    );
  };

  return (
    <Modal
      onClose={onClose}
      title={
        title ||
        `Metrics for ${
          machineId
            ? `Machine ${machineId}`
            : apiKeyId
              ? `API Key ${apiKeyId}`
              : userId
                ? `User ${userId}`
                : userSession?.user.role === "admin"
                  ? "All Users"
                  : "Your Usage"
        }`
      }
      maxWidth="sm:max-w-6xl"
    >
      <div className="space-y-4">{renderContent()}</div>
    </Modal>
  );
};

export default MetricsModal;
