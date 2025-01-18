import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios, { AxiosError } from "axios";
import { API_BASE_URL } from "src/config";
import { useSession } from "./useSession";

export interface ApiKey {
  token: string;
  description: string;
  created_at: string;
}

const fetchApiKeys = async (token?: string): Promise<ApiKey[]> => {
  if (!token) {
    throw new Error("No token provided");
  }
  const response = await axios.get(`${API_BASE_URL}/api-tokens`, {
    headers: { Authorization: `Bearer ${token}` },
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

  const query = useQuery<ApiKey[]>({
    queryKey: ["apiKeys"],
    queryFn: () => fetchApiKeys(userSession?.access_token),
    enabled: !!userSession?.access_token,
  });

  const mutation = useMutation({
    mutationFn: (description: string) => {
      if (!userSession?.access_token) {
        throw new Error("User session not found");
      }
      let toAdd = description;
      if (!toAdd || toAdd.length === 0) {
        toAdd = `secret-key-${(query?.data?.length ?? 0) + 1}`;
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
