import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "src/utils/supabase/client";

export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await supabase.auth.signOut();
      if (res.error) throw res.error;
      return res;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["userSession"] });
      // setTimeout to wait for the userSession invalidateQueries to finish
      setTimeout(async () => {
        // Invalidate all queries
        await queryClient.invalidateQueries();
      }, 0);
    },
  });
}
