import { useQuery } from "@tanstack/react-query";
import api from "src/lib/axios";
import { useSession } from "./useSession";

const fetchInferenceCalls = async () => {
  const response = await api.get(`/total-inference-calls`);
  return response.data;
};

const useTotalInferenceCalls = () => {
  const { user } = useSession();

  return useQuery({
    queryKey: ["inferenceCalls", user?.id],
    queryFn: () => fetchInferenceCalls(),
    enabled: !!user,
  });
};

export default useTotalInferenceCalls;
