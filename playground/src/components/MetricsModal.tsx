import { useQuery } from "@tanstack/react-query";
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
import { format, parseISO } from "date-fns";
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
  machineId?: number; // Changed from machineIP: string
  onClose: () => void;
  title?: string;
  apiKeyId?: number;
  userId?: string;
  modelFilter?: string;
  dateRange?: {
    startDate?: string;
    endDate?: string;
  };
  flowId?: string;
}

const Shimmer = () => (
  <div className="w-full h-full bg-gray-200 rounded-sm animate-pulse" />
);

const ValueShimmer = () => (
  <div className="w-16 h-6 bg-gray-200 rounded-sm animate-pulse" />
);

const ChartShimmer = () => (
  <div className="w-full h-full rounded-lg animate-pulse bg-gray-200/60" />
);

// Add new types for the metrics response
interface MetricsResponse {
  total_tokens: number;
  prompt_tokens: number;
  completion_tokens: number;
  avg_response_time: number;
  avg_ttft: number;
  total_cost: number;
  model_distribution: [string, number][];
}

const MetricsModal = ({
  machineId, // Changed from machineIP
  onClose,
  title,
  apiKeyId,
  userId,
  modelFilter,
  dateRange,
  flowId,
}: MetricsModalProps) => {
  const { data: userSession } = useSession();
  const [dateRangeState, setDateRangeState] = useState("7");

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

  // const getStartDate = useCallback(() => {
  //   const date = new Date();
  //   switch (dateRangeState) {
  //     case "1":
  //       date.setDate(date.getDate() - 1);
  //       break;
  //     case "7":
  //       date.setDate(date.getDate() - 7);
  //       break;
  //     case "30":
  //       date.setDate(date.getDate() - 30);
  //       break;
  //     case "90":
  //       date.setDate(date.getDate() - 90);
  //       break;
  //   }
  //   return date;
  // }, [dateRangeState]);

  // Replace the existing query with the new metrics endpoint
  const { data, isLoading, error } = useQuery<MetricsResponse>({
    queryKey: [
      "metrics",
      machineId, // Changed from machineIP
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
          ...(machineId && { machine_id: machineId }), // Changed from machine_ip: machineIP
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

    // Since we don't have time series data, we'll create simple aggregate visualizations
    return {
      models: {
        labels: data.model_distribution.map(([model]) => model),
        datasets: [
          {
            data: data.model_distribution.map(([, count]) => count),
            backgroundColor: [
              "rgba(255, 99, 132, 0.5)",
              "rgba(54, 162, 235, 0.5)",
              "rgba(255, 206, 86, 0.5)",
              "rgba(75, 192, 192, 0.5)",
              "rgba(153, 102, 255, 0.5)",
              "rgba(255, 159, 64, 0.5)",
            ],
          },
        ],
      },
      tokens: {
        labels: ["Prompt Tokens", "Completion Tokens"],
        datasets: [
          {
            data: [data.prompt_tokens, data.completion_tokens],
            backgroundColor: ["rgba(54, 162, 235, 0.5)", "rgba(75, 192, 192, 0.5)"],
          },
        ],
      },
    };
  }, [data]);

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
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {renderMetricBlock("Total Cost", null, null, false, true)}
            {renderMetricBlock("Token Usage", null, null, false, true)}
            {renderMetricBlock("Avg TTFT", null, null, false, true)}
            {renderMetricBlock("Avg Response Time", null, null, false, true)}
          </div>

          <div className="bg-white border border-gray-100 rounded-lg shadow-xs">
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
        </div>
      );
    }

    if (error) {
      return (
        <div className="px-4 py-3 text-red-700 bg-red-100 border border-red-400 rounded-sm">
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
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {renderMetricBlock("Total Cost", `$${data.total_cost.toFixed(4)}`, null)}
          {renderMetricBlock(
            "Token Usage",
            data.total_tokens.toLocaleString(),
            chartData && <Doughnut data={chartData.tokens} options={chartOptions} />
          )}
          {renderMetricBlock("Avg TTFT", `${data.avg_ttft.toFixed(2)}ms`, null)}
          {renderMetricBlock(
            "Avg Response Time",
            `${data.avg_response_time.toFixed(2)}ms`,
            null
          )}
        </div>

        {/* Model Distribution */}
        <div className="transition-all duration-200 bg-white border border-gray-100 rounded-lg shadow-xs hover:shadow-md">
          <div className="px-3 py-2 border-b border-gray-100">
            <h3 className="text-sm font-medium text-gray-700">Model Distribution</h3>
          </div>
          <div className="p-3">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-1.5 text-sm">
                {data.model_distribution.map(([model, count]) => (
                  <div
                    key={model}
                    className="flex items-center justify-between px-2 py-1 rounded-sm bg-gray-50"
                  >
                    <span className="mr-2 text-xs text-gray-600 truncate">{model}</span>
                    <span className="text-xs font-medium text-gray-900">
                      {count} calls
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
            ? `Machine ${machineId}` // Changed from machineIP
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
