import { useQuery } from "@tanstack/react-query";
import api from "src/lib/axios";
import { DEFAULT_PARAMS } from "src/state/apiLogsParamsState";
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
  page = 1,
  pageSize = 100,
  startDate,
  endDate,
  orderBy = "created_at",
  order = "desc",
  machineId,
}: {
  page: number;
  pageSize: number;
  startDate: string;
  endDate: string;
  orderBy: string;
  order: string;
  machineId?: string | null;
}) => {
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

  const response = await api.get(`/api-logs`, { params });
  return response.data;
};

const useAllApiLogs = () => {
  const { user } = useSession();
  const params = DEFAULT_PARAMS;

  const { data, error, isLoading } = useQuery<ApiLogsResponse, Error>({
    queryKey: [
      "allApiLogs",
      params.startDate,
      params.endDate,
      params.orderBy,
      params.order,
      params.page,
      params.pageSize,
      params.machineId,
      user?.id,
    ],
    queryFn: async () => {
      return await fetchApiLogs({
        page: params.page,
        pageSize: params.pageSize,
        startDate: params.startDate,
        endDate: params.endDate,
        orderBy: params.orderBy,
        order: params.order,
        machineId: params.machineId,
      });
    },
    enabled: !!user,
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

export default useAllApiLogs;
