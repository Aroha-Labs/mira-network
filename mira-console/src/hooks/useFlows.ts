import { useQuery } from "@tanstack/react-query";
import { supabase } from "../supabase";

interface Flow {
  id: number;
  name: string;
  icon: string;
  system_prompt: string;
}

export function useFlows() {
  const fetchFlows = async (): Promise<Flow[]> => {
    const { data, error } = await supabase
      .from("flows")
      .select("*")
      .order("id", { ascending: true });

    if (error) throw error;
    return data || [];
  };

  return useQuery({
    queryKey: ["flows"],
    queryFn: fetchFlows,
    refetchInterval: false,
  });
}
