import { useQuery } from "@tanstack/react-query";
import { supabase } from "src/utils/supabase/client";

export function useUser() {
  return useQuery({
    queryKey: ["user"],
    queryFn: async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        if (error.message === "Auth session missing!") {
          return null;
        }
        throw new Error(error.message);
      }
      return data.user;
    },
  });
}
