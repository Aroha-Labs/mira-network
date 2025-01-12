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
}

const Shimmer = () => (
  <div className="animate-pulse bg-gray-200 rounded h-full w-full" />
);

const ValueShimmer = () => (
  <div className="animate-pulse bg-gray-200 rounded h-6 w-16" />
);

const ChartShimmer = () => (
  <div className="animate-pulse bg-gray-200/60 rounded-lg h-full w-full" />
);

const MetricsModal = ({
  onClose,
  title,
  machineId,
  apiKeyId,
  userId,
}: MetricsModalProps) => {
  const { data: userSession } = useSession();
  const [dateRange, setDateRange] = useState("7");

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
    switch (dateRange) {
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
  }, [dateRange]);

  const { data, isLoading, error } = useQuery<{ logs: ApiLog[] }>({
    queryKey: ["metrics-logs", machineId, apiKeyId, userId, dateRange],
    queryFn: async () => {
      const resp = await api.get("/api-logs", {
        params: {
          ...(machineId && { machine_id: machineId }),
          ...(apiKeyId && { api_key_id: apiKeyId }),
          ...(userId && { user_id: userId }),
          start_date: getStartDate().toISOString().split("T")[0],
          page_size: 10000,
        },
      });
      return resp.data;
    },
    enabled: !!userSession?.access_token,
  });

  const metrics = useMemo(() => {
    if (!data?.logs) return null;
    const logs = data.logs;
    const totalCalls = logs.length;
    const totalTokens = logs.reduce((sum, log) => sum + log.total_tokens, 0);
    const avgResponseTime =
      logs.reduce((sum, log) => sum + log.total_response_time, 0) / totalCalls;
    const avgTTFT =
      logs.reduce((sum, log) => sum + (log.ttft || 0), 0) / totalCalls;
    const totalCost = logs.reduce((sum, log) => {
      if (!log.model_pricing) return sum;
      return (
        sum +
        (log.prompt_tokens * log.model_pricing.prompt_token +
          log.completion_tokens * log.model_pricing.completion_token)
      );
    }, 0);

    const modelUsage = logs.reduce((acc, log) => {
      acc[log.model] = (acc[log.model] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalCalls,
      totalTokens,
      avgResponseTime,
      avgTTFT,
      totalCost,
      modelUsage,
    };
  }, [data]);

  const groupData = useCallback(
    (logs: ApiLog[]) => {
      const groups = new Map<string, ApiLog[]>();
      const startDate = getStartDate();
      const endDate = new Date();

      // Generate all possible keys with proper ordering
      const generateTimeSlots = () => {
        const slots: { key: string; date: Date }[] = [];
        let current = startDate;

        while (isBefore(current, endDate)) {
          let key = "";
          switch (dateRange) {
            case "1":
              const hour = startOfHour(current).getHours();
              const fourHourBlock = Math.floor(hour / 4);
              key = `${format(current, "yyyy-MM-dd")}-${fourHourBlock}`;
              slots.push({ key, date: current });
              current = addHours(current, 4);
              break;
            case "7":
              key = format(startOfDay(current), "yyyy-MM-dd");
              slots.push({ key, date: current });
              current = addDays(current, 1);
              break;
            case "30":
              key = format(startOfWeek(current), "yyyy-MM-dd");
              slots.push({ key, date: current });
              current = addWeeks(current, 1);
              break;
            case "90":
              key = format(startOfMonth(current), "yyyy-MM");
              slots.push({ key, date: current });
              current = addMonths(current, 1);
              break;
          }
        }
        return slots;
      };

      const timeSlots = generateTimeSlots();
      timeSlots.forEach(({ key }) => {
        groups.set(key, []);
      });

      // Group logs into slots
      logs.forEach((log) => {
        const date = parseISO(log.created_at);
        const key = timeSlots.find((slot) => {
          const nextSlot = timeSlots[timeSlots.indexOf(slot) + 1];
          return (
            (!nextSlot || isBefore(date, nextSlot.date)) &&
            !isBefore(date, slot.date)
          );
        })?.key;

        if (key && groups.has(key)) {
          groups.get(key)?.push(log);
        }
      });

      const getGroupLabel = (date: Date) => {
        switch (dateRange) {
          case "1":
            const hour = startOfHour(date).getHours();
            const hourBlock = Math.floor(hour / 4) * 4;
            return `${hourBlock}:00-${hourBlock + 4}:00`;
          case "7":
            return format(date, "EEE, MMM d");
          case "30":
            return `Week ${format(date, "w")}`;
          case "90":
            return format(date, "MMM, yy");
          default:
            return format(date, "MMM d");
        }
      };

      return {
        keys: timeSlots.map(({ key }) => key),
        labels: timeSlots.map(({ date }) => getGroupLabel(date)),
        data: timeSlots.map(({ key }) => groups.get(key) || []),
      };
    },
    [dateRange, getStartDate]
  );

  const chartData = useMemo(() => {
    if (!data?.logs || !metrics) return null;

    const grouped = groupData(
      [...data.logs].sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )
    );

    // Add calls data
    const callsData = grouped.data.map((logs) => logs.length);

    // Split tokens into prompt and completion, and calculate total
    const promptTokens = grouped.data.map((logs) =>
      logs.reduce((sum, log) => sum + log.prompt_tokens, 0)
    );
    const completionTokens = grouped.data.map((logs) =>
      logs.reduce((sum, log) => sum + log.completion_tokens, 0)
    );
    const totalTokens = promptTokens.map((p, i) => p + completionTokens[i]);

    const responseTimeData = grouped.data.map(
      (logs) =>
        logs.reduce((sum, log) => sum + log.total_response_time, 0) /
        logs.length
    );

    // Split costs into prompt and completion
    const promptCost = grouped.data.map((logs) =>
      logs.reduce((sum, log) => {
        if (!log.model_pricing) return sum;
        return sum + log.prompt_tokens * log.model_pricing.prompt_token;
      }, 0)
    );

    const completionCost = grouped.data.map((logs) =>
      logs.reduce((sum, log) => {
        if (!log.model_pricing) return sum;
        return sum + log.completion_tokens * log.model_pricing.completion_token;
      }, 0)
    );

    const ttftData = grouped.data.map(
      (logs) =>
        logs.reduce((sum, log) => sum + (log.ttft || 0), 0) / (logs.length || 1)
    );

    const modelData = Object.entries(metrics.modelUsage);

    return {
      calls: {
        labels: grouped.labels,
        datasets: [
          {
            label: "Number of Calls",
            data: callsData,
            backgroundColor: "rgba(99, 102, 241, 0.5)", // Different color from cost
          },
        ],
      },
      tokens: {
        labels: grouped.labels,
        datasets: [
          {
            type: "bar" as const,
            label: "Completion Tokens",
            data: completionTokens,
            backgroundColor: "rgba(75, 192, 192, 0.5)",
            stack: "tokens",
            order: 2,
          },
          {
            type: "bar" as const,
            label: "Prompt Tokens",
            data: promptTokens,
            backgroundColor: "rgba(54, 162, 235, 0.5)",
            stack: "tokens",
            order: 2,
          },
          {
            type: "line" as const,
            label: "Total Tokens",
            data: totalTokens,
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
        labels: grouped.labels,
        datasets: [
          {
            label: "Response Time (ms)",
            data: responseTimeData,
            borderColor: "rgb(255, 99, 132)",
            tension: 0.1,
          },
        ],
      },
      cost: {
        labels: grouped.labels,
        datasets: [
          {
            label: "Completion Cost",
            data: completionCost,
            backgroundColor: "rgba(75, 192, 192, 0.5)",
            stack: "cost",
          },
          {
            label: "Prompt Cost",
            data: promptCost,
            backgroundColor: "rgba(54, 162, 235, 0.5)",
            stack: "cost",
          },
        ],
      },
      ttft: {
        labels: grouped.labels,
        datasets: [
          {
            label: "Time to First Token (ms)",
            data: ttftData,
            borderColor: "rgb(168, 85, 247)", // Purple color
            tension: 0.1,
          },
        ],
      },
      models: {
        labels: modelData.map(([model]) => model),
        datasets: [
          {
            data: modelData.map(([_, count]) => count),
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
  }, [data, metrics, groupData]);

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
        <div className="flex justify-between items-baseline">
          <h3 className="text-gray-700 font-medium text-sm">{title}</h3>
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {renderMetricBlock("Cost Distribution", null, null, false, true)}
            {renderMetricBlock("Token Usage", null, null, false, true)}
            {renderMetricBlock("Time to First Token", null, null, false, true)}
            {renderMetricBlock("Avg Response Time", null, null, false, true)}
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-100">
            <div className="px-3 py-2 border-b border-gray-100">
              <h3 className="text-gray-700 font-medium text-sm">
                Model Distribution
              </h3>
            </div>
            <div className="p-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <p className="font-bold">Error loading metrics</p>
          <p>{(error as Error).message}</p>
        </div>
      );
    }

    if (!metrics || !chartData) {
      return <div className="text-center text-gray-600">No data available</div>;
    }

    return (
      <div className="space-y-4">
        {/* Date range buttons */}
        <div className="bg-white px-2 py-1.5 rounded-lg shadow-sm border border-gray-100 flex justify-end gap-1.5 overflow-x-auto">
          {[
            { value: "1", label: "24h" },
            { value: "7", label: "7d" },
            { value: "30", label: "30d" },
            { value: "90", label: "3m" },
          ].map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setDateRange(value)}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors duration-200 ${
                dateRange === value
                  ? "bg-blue-500 text-white shadow-sm"
                  : "bg-gray-50 text-gray-600 hover:bg-gray-100"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {renderMetricBlock(
            "Cost Distribution",
            `$${metrics.totalCost.toFixed(4)}`,
            chartData && (
              <Bar data={chartData.cost} options={getChartOptions("cost")} />
            )
          )}
          {renderMetricBlock(
            "Token Usage",
            metrics.totalTokens.toLocaleString(),
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
            `${metrics.avgTTFT.toFixed(2)}ms`,
            chartData && <Line data={chartData.ttft} options={chartOptions} />
          )}
          {renderMetricBlock(
            "Avg Response Time",
            `${metrics.avgResponseTime.toFixed(2)}ms`,
            chartData && (
              <Line data={chartData.responseTime} options={chartOptions} />
            )
          )}
        </div>

        {/* Model Distribution */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 transition-all duration-200 hover:shadow-md">
          <div className="px-3 py-2 border-b border-gray-100">
            <h3 className="text-gray-700 font-medium text-sm">
              Model Distribution
            </h3>
          </div>
          <div className="p-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5 text-sm">
                {Object.entries(metrics.modelUsage).map(([model, count]) => (
                  <div
                    key={model}
                    className="flex justify-between items-center px-2 py-1 bg-gray-50 rounded"
                  >
                    <span className="truncate text-gray-600 mr-2 text-xs">
                      {model}
                    </span>
                    <span className="font-medium text-gray-900 text-xs">
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

        {/* Total Calls */}
        {renderMetricBlock(
          "Total Calls",
          metrics.totalCalls.toString(),
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
            : "Unknown"
        }`
      }
    >
      {renderContent()}
    </Modal>
  );
};

export default MetricsModal;
