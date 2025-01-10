import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { API_BASE_URL } from "src/config";
import { useSession } from "./useSession";

const fetchUserCredits = async (token: string) => {
  const response = await axios.get(`${API_BASE_URL}/user-credits`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data;
};

const useUserCredits = () => {
  const { data: userSession } = useSession();

  const { data: userCredits, isLoading: isCreditsLoading } = useQuery({
    queryKey: ["userCredits"],
    queryFn: () => {
      if (!userSession?.access_token) {
        throw new Error("User session not found");
      }
      return fetchUserCredits(userSession.access_token);
    },
    enabled: !!userSession?.access_token,
  });

  return { userCredits, isCreditsLoading };
};

export default useUserCredits;
