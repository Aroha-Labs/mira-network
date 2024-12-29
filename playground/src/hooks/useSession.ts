import { useQuery } from "@tanstack/react-query";
import { supabase } from "src/utils/supabase/client";

export function useSession() {
  return useQuery({
    queryKey: ["useSession"],
    queryFn: async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        throw error;
      }
      return data.session;
    },
  });
}
