import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { addDays, format, subDays } from "date-fns";
import { API_BASE_URL } from "src/config";
import { useSession } from "./useSession";

export interface ApiLog {
  completion_tokens: number;
  created_at: string;
  id: number;
  model: string;
  payload: string;
  prompt_tokens: number;
  response: string;
  total_response_time: number;
  total_tokens: number;
  user_id: string;
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

const useApiLogs = () => {
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

  const chartDataByDay = data?.logs?.map((log) => ({
    date: log.created_at,
    total_tokens: log.total_tokens,
  }));

  const totalTokens = data?.logs?.reduce(
    (acc, log) => acc + log.total_tokens,
    0
  );

  return {
    chartDataByDay,
    isLoading,
    error,
    data,
    totalTokens,
  };
};

export default useApiLogs;
