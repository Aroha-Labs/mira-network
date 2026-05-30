import { useSession as useBetterAuthSession } from "src/lib/auth-client";

export function useSession() {
  const { data, isPending, error } = useBetterAuthSession();

  return {
    data: data?.session ?? null,
    user: data?.user ?? null,
    isLoading: isPending,
    error,
  };
}
