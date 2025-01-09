import axios from "axios";
import { API_BASE_URL } from "src/config";
import { useSession } from "./useSession";

import { useQuery } from "@tanstack/react-query";

interface ApiKey {
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

const useApiTokens = () => {
  const { data: userSession } = useSession();
  return useQuery<ApiKey[]>({
    queryKey: ["apiKeys"],
    queryFn: () => fetchApiKeys(userSession?.access_token),
    enabled: !!userSession?.access_token,
  });
};

export default useApiTokens;
