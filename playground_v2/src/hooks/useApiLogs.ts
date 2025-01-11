import { useQuery } from "@tanstack/react-query";
import { useStore } from "@tanstack/react-store";
import axios from "axios";
import { API_BASE_URL } from "src/config";
import { apiLogsParamsState } from "src/state/apiLogsParamsState";
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
  machine_id: string;
}

export interface ApiLogsResponse {
  logs: ApiLog[];
  total: number;
  page_size: number;
}

const fetchApiLogs = async (
  token?: string,
  page: number = 1,
  pageSize: number = 100,
  startDate?: string,
  endDate?: string,
  orderBy: string = "created_at",
  order: string = "desc"
): Promise<ApiLogsResponse> => {
  console.log("fetching api logs", page);
  if (!token) {
    throw new Error("No token provided");
  }
  const response = await axios.get(`${API_BASE_URL}/api-logs`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    params: {
      page,
      page_size: pageSize,
      start_date: startDate,
      end_date: endDate,
      order_by: orderBy,
      order,
    },
  });
  return response.data;
};

const useApiLogs = () => {
  const params = useStore(apiLogsParamsState, (state) => state);
  const { data: userSession } = useSession();

  const { data, error, isLoading } = useQuery<ApiLogsResponse, Error>({
    queryKey: [
      "apiLogs",
      params.startDate,
      params.endDate,
      params.orderBy,
      params.order,
      params.page,
      params.pageSize,
      userSession?.access_token,
    ],
    queryFn: async () => {
      if (!userSession?.access_token) {
        throw new Error("User session not found");
      }
      return await fetchApiLogs(
        userSession.access_token,
        params.page,
        params.pageSize,
        params.startDate,
        params.endDate,
        params.orderBy,
        params.order
      );
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
