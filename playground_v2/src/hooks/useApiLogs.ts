import { useQuery } from "@tanstack/react-query";
import { useStore } from "@tanstack/react-store";
import axios from "axios";
import { API_BASE_URL } from "src/config";
import { apiLogsParamsState } from "src/state/apiLogsParamsState";
import getAllDaysBetween from "src/utils/getAllDaysBetween";
import { useSession } from "./useSession";

export interface ApiLog {
  id: number;
  request_payload: {
    model: string;
    stream: boolean;
    messages: {
      role: string;
      content: string;
    }[];
    model_provider: string | null;
  };
  response: string;
  completion_tokens: number;
  total_response_time: number;
  model_pricing: {
    prompt_token: number;
    completion_token: number;
  };
  created_at: string;
  ttft: number;
  user_id: string;
  payload: string;
  prompt_tokens: number;
  total_tokens: number;
  model: string;
  machine_id: string;
}

export interface ApiLogsResponse {
  logs: ApiLog[];
  total: number;
  page_size: number;
}

interface ApiLogsParams {
  page: number;
  page_size: number;
  start_date: string;
  end_date: string;
  order_by: string;
  order: string;
  machine_id?: string | null;
}

const fetchApiLogs = async ({
  token,
  page = 1,
  pageSize = 100,
  startDate,
  endDate,
  orderBy = "created_at",
  order = "desc",
  machineId,
}: {
  token: string;
  page: number;
  pageSize: number;
  startDate: string;
  endDate: string;
  orderBy: string;
  order: string;
  machineId?: string | null;
}) => {
  console.log("fetching api logs", page);
  if (!token) {
    throw new Error("No token provided");
  }
  const params: ApiLogsParams = {
    page,
    page_size: pageSize,
    order_by: orderBy,
    order,
    start_date: startDate,
    end_date: endDate,
  };
  if (machineId) {
    params.machine_id = machineId;
  }

  const response = await axios.get(`${API_BASE_URL}/api-logs`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    params,
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
      params.machineId,
      userSession?.access_token,
    ],
    queryFn: async () => {
      if (!userSession?.access_token) {
        throw new Error("User session not found");
      }
      return await fetchApiLogs({
        token: userSession.access_token,
        page: params.page,
        pageSize: params.pageSize,
        startDate: params.startDate,
        endDate: params.endDate,
        orderBy: params.orderBy,
        order: params.order,
        machineId: params.machineId,
      });
    },
    enabled: !!userSession?.access_token,
  });

  const chartDataByDay = getAllDaysBetween(
    params.startDate,
    params.endDate,
    data?.logs ?? []
  );

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
