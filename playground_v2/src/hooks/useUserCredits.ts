import { useQuery } from "@tanstack/react-query";
import api from "src/lib/axios";
import { useSession } from "./useSession";

export interface CreditHistory {
  id: number;
  user_id: string;
  amount: number;
  description: string;
  created_at: string;
}

const fetchUserCredits = async () => {
  const response = await api.get(`/user-credits`);
  return response.data;
};

const fetchCreditHistory = async (): Promise<CreditHistory[]> => {
  const response = await api.get(`/user-credits-history`);
  return response.data;
};

const useUserCredits = () => {
  const { user } = useSession();

  const { data: userCredits, isLoading: isCreditsLoading } = useQuery({
    queryKey: ["userCredits", user?.id],
    queryFn: () => fetchUserCredits(),
    enabled: !!user,
  });

  return { userCredits, isCreditsLoading };
};

export const useUserCreditsHistory = () => {
  const { user } = useSession();
  const { data: userCreditsHistory, isLoading: isCreditsHistoryLoading } =
    useQuery({
      queryKey: ["userCreditsHistory", user?.id],
      queryFn: () => fetchCreditHistory(),
      enabled: !!user,
    });
  return { userCreditsHistory, isCreditsHistoryLoading };
};

export default useUserCredits;
