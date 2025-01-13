"use client";

import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { API_BASE_URL } from "src/config";
import { useSession } from "src/hooks/useSession";
import { addDays, format, subDays } from "date-fns";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import Loading from "src/components/PageLoading";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface ApiLog {
  created_at: string;
  total_tokens: number;
  model: string;
}

interface ApiLogsResponse {
  logs: ApiLog[];
  total: number;
}

const fetchApiLogs = async (
  token: string,
  startDate: string,
  endDate: string
): Promise<ApiLogsResponse> => {
  const response = await axios.get(`${API_BASE_URL}/api-logs`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    params: {
      start_date: startDate,
      end_date: endDate,
      page_size: 1000, // Fetch a large number of logs to ensure we get all data
    },
  });
  return response.data;
};

const AnalyticsPage = () => {
  const { data: userSession } = useSession();
  const endDate = format(addDays(new Date(), 1), "yyyy-MM-dd");
  const startDate = format(subDays(new Date(), 30), "yyyy-MM-dd");

  const { data, error, isLoading } = useQuery({
    queryKey: ["apiLogs", startDate, endDate],
    queryFn: () => {
      if (!userSession?.access_token) {
        throw new Error("User session not found");
      }
      return fetchApiLogs(userSession.access_token, startDate, endDate);
    },
    enabled: !!userSession?.access_token,
  });

  if (isLoading) {
    return <Loading fullPage />;
  }

  if (error) {
    return <div>Error loading analytics data</div>;
  }

  const tokenUsageByDay = data?.logs.reduce((acc: Record<string, number>, log) => {
    const date = format(new Date(log.created_at), "yyyy-MM-dd");
    if (!acc[date]) {
      acc[date] = 0;
    }
    acc[date] += log.total_tokens;
    return acc;
  }, {});

  const tokenUsageByModel = data?.logs.reduce((acc: Record<string, number>, log) => {
    if (!acc[log.model]) {
      acc[log.model] = 0;
    }
    acc[log.model] += log.total_tokens;
    return acc;
  }, {});

  const labels = Array.from({ length: 30 }, (_, i) =>
    format(subDays(new Date(), 29 - i), "yyyy-MM-dd")
  );

  const modelLabels = Object.keys(tokenUsageByModel || {});

  const chartDataByDay = {
    labels,
    datasets: [
      {
        label: "Total Tokens Used",
        data: labels.map((label) => tokenUsageByDay?.[label] || 0),
        backgroundColor: "rgba(75, 192, 192, 0.2)",
        borderColor: "rgba(75, 192, 192, 1)",
        borderWidth: 1,
      },
    ],
  };

  const chartDataByModel = {
    labels: modelLabels,
    datasets: [
      {
        label: "Total Tokens Used",
        data: modelLabels.map((label) => tokenUsageByModel?.[label] || 0),
        backgroundColor: "rgba(153, 102, 255, 0.2)",
        borderColor: "rgba(153, 102, 255, 1)",
        borderWidth: 1,
      },
    ],
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Analytics (last 30 days)</h1>
      <div className="bg-white p-4 rounded shadow mb-8">
        <h2 className="text-xl font-bold mb-4">Token Usage by Day</h2>
        <Bar data={chartDataByDay} />
      </div>
      <div className="bg-white p-4 rounded shadow">
        <h2 className="text-xl font-bold mb-4">Token Usage by Model</h2>
        <Bar data={chartDataByModel} />
      </div>
    </div>
  );
};

export default AnalyticsPage;
