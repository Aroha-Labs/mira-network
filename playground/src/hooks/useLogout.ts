import { useMutation, useQueryClient } from "@tanstack/react-query";
import { signOut } from "src/lib/auth-client";

export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await signOut();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries();
    },
  });
}
