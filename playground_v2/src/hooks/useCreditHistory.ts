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

const fetchCreditHistory = async (): Promise<{
  history: CreditHistory[];
  total: number;
  page_size: number;
}> => {
  const response = await api.get("/user-credits-history");
  const data = response.data;
  return {
    history: data,
    total: data.length,
    page_size: 1000000,
  };
};

const useCreditHistory = () => {
  const { user } = useSession();

  return useQuery({
    queryKey: ["creditHistory", user?.id],
    queryFn: fetchCreditHistory,
    enabled: !!user,
  });
};

export default useCreditHistory;
