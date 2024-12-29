import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "src/utils/supabase/client";

export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await supabase.auth.signOut();
      if (res.error) {
        throw new Error(res.error.message);
      }

      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user"] });
    },
  });
}
