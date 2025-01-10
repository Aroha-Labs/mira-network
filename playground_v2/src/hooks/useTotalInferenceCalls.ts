import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { API_BASE_URL } from "src/config";
import { useSession } from "./useSession";

const fetchInferenceCalls = async (token: string) => {
  const response = await axios.get(`${API_BASE_URL}/total-inference-calls`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data;
};

const useTotalInferenceCalls = () => {
  const { data: userSession } = useSession();

  return useQuery({
    queryKey: ["inferenceCalls"],
    queryFn: () => {
      if (!userSession?.access_token) {
        throw new Error("User session not found");
      }
      return fetchInferenceCalls(userSession.access_token);
    },
    enabled: !!userSession?.access_token,
  });
};

export default useTotalInferenceCalls;
