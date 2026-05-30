import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useStore } from "@tanstack/react-store";
import { AxiosError } from "axios";
import api from "src/lib/axios";
import {
  apiKeysParamsState,
  DEFAULT_PARAMS,
} from "src/state/apiKeysParamsState";
import { useSession } from "./useSession";

export interface ApiKey {
  token: string;
  description: string;
  created_at: string;
}

export interface ApiKeysResponse {
  items: ApiKey[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

interface ApiKeysParams {
  page: number;
  page_size: number;
  order_by: string;
  order: string;
}

const fetchApiKeys = async ({
  page = DEFAULT_PARAMS.page,
  pageSize = DEFAULT_PARAMS.pageSize,
  orderBy = DEFAULT_PARAMS.orderBy,
  order = DEFAULT_PARAMS.order,
}: {
  page?: number;
  pageSize?: number;
  orderBy?: string;
  order?: string;
}): Promise<ApiKeysResponse> => {
  const params: ApiKeysParams = {
    page,
    page_size: pageSize,
    order_by: orderBy,
    order,
  };
  const response = await api.get(`/api-tokens`, { params });
  return response.data;
};

const deleteApiKey = async (tokenId: string) => {
  const response = await api.delete(`/api-tokens/${tokenId}`);
  return response.data;
};

const addApiKey = async (description: string) => {
  try {
    if (!description || description.length === 0) {
      return;
    }
    const response = await api.post(`/api-tokens`, { description });
    return response.data;
  } catch (e) {
    const error = e as AxiosError<{ detail: string }>;
    throw new Error(error.response?.data?.detail ?? error.message);
  }
};

const useApiTokens = () => {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const params = useStore(apiKeysParamsState, (state) => state);

  const query = useQuery<ApiKeysResponse>({
    queryKey: [
      "apiKeys",
      params.page,
      params.pageSize,
      params.orderBy,
      params.order,
      user?.id,
    ],
    queryFn: () =>
      fetchApiKeys({
        page: params.page,
        pageSize: params.pageSize,
        orderBy: params.orderBy,
        order: params.order,
      }),
    enabled: !!user,
  });

  const mutation = useMutation({
    mutationFn: (description: string) => {
      let toAdd = description;
      if (!toAdd || toAdd.length === 0) {
        toAdd = `secret-key-${(query?.data?.items?.length ?? 0) + 1}`;
      }
      return addApiKey(toAdd);
    },
    onSuccess: () => {
      // Refetch the 'apiKeys' query after a successful mutation
      queryClient.invalidateQueries({
        queryKey: ["apiKeys"],
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (tokenId: string) => {
      return deleteApiKey(tokenId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["apiKeys"],
      });
    },
  });

  return { ...query, addApiKey: mutation, deleteMutation };
};

export default useApiTokens;
