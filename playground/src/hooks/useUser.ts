import { useSession } from "src/hooks/useSession";

export function useUser() {
  const { user, isLoading, error } = useSession();

  return {
    data: user,
    isLoading,
    error,
  };
}
