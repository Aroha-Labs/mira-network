import { QueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

export function useQueryClient() {
  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 5, // 5 minutes
            gcTime: 1000 * 60 * 60 * 24, // 24 hours
            retry: 2,
            networkMode: 'online',
          },
          mutations: {
            networkMode: 'online',
          },
        },
      }),
    []
  );

  return queryClient;
}
