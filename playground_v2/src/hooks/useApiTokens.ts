import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useStore } from "@tanstack/react-store";
import axios, { AxiosError } from "axios";
import { API_BASE_URL } from "src/config";
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
  token,
  page = DEFAULT_PARAMS.page,
  pageSize = DEFAULT_PARAMS.pageSize,
  orderBy = DEFAULT_PARAMS.orderBy,
  order = DEFAULT_PARAMS.order,
}: {
  token?: string;
  page?: number;
  pageSize?: number;
  orderBy?: string;
  order?: string;
}): Promise<ApiKeysResponse> => {
  if (!token) {
    throw new Error("No token provided");
  }
  const params: ApiKeysParams = {
    page,
    page_size: pageSize,
    order_by: orderBy,
    order,
  };
  const response = await axios.get(`${API_BASE_URL}/api-tokens`, {
    headers: { Authorization: `Bearer ${token}` },
    params,
  });
  return response.data;
};

const deleteApiKey = async (token: string, tokenId: string) => {
  const response = await axios.delete(`${API_BASE_URL}/api-tokens/${tokenId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data;
};

const addApiKey = async (token: string, description: string) => {
  try {
    if (!description || description.length === 0) {
      return;
    }
    const response = await axios.post(
      `${API_BASE_URL}/api-tokens`,
      { description },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  } catch (e) {
    const error = e as AxiosError<{ detail: string }>;
    throw new Error(error.response?.data?.detail ?? error.message);
  }
};

const useApiTokens = () => {
  const { data: userSession } = useSession();
  const queryClient = useQueryClient();
  const params = useStore(apiKeysParamsState, (state) => state);

  const query = useQuery<ApiKeysResponse>({
    queryKey: [
      "apiKeys",
      params.page,
      params.pageSize,
      params.orderBy,
      params.order,
      userSession?.access_token,
    ],
    queryFn: () =>
      fetchApiKeys({
        token: userSession?.access_token,
        page: params.page,
        pageSize: params.pageSize,
        orderBy: params.orderBy,
        order: params.order,
      }),
    enabled: !!userSession?.access_token,
  });

  const mutation = useMutation({
    mutationFn: (description: string) => {
      if (!userSession?.access_token) {
        throw new Error("User session not found");
      }
      let toAdd = description;
      if (!toAdd || toAdd.length === 0) {
        toAdd = `secret-key-${(query?.data?.items?.length ?? 0) + 1}`;
      }
      return addApiKey(userSession.access_token, toAdd);
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
      if (!userSession?.access_token) {
        throw new Error("User session not found");
      }
      return deleteApiKey(userSession.access_token, tokenId);
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
