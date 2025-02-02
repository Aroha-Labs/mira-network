import { QueryClient } from '@tanstack/react-query';
import { WalletResponse } from '@/types/wallet';

// Base API configuration
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

// API error type
export interface ApiError {
  message: string;
  status: number;
}

// Generic API response type
export interface ApiResponse<T> {
  data: T;
  status: number;
}


// Fetch wrapper with type safety
export async function fetchApi<T>(
  endpoint: string,
  token: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const url = `${API_BASE_URL}${endpoint}`;
  console.log("request url:", token);
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
      Authorization: `Bearer ${token}`,
    },
  });

  console.log("response:", response);

  if (!response.ok) {
    const error: ApiError = {
      message: 'An error occurred while fetching the data.',
      status: response.status,
    };

    try {
      const data = await response.json();
      error.message = data.message || error.message;
    } catch {
      // If parsing JSON fails, use default error message
    }

    throw error;
  }

  const data = await response.json();
  return { data, status: response.status };
}

// Utility function to invalidate queries
export function invalidateQueries(queryClient: QueryClient, queryKey: string[]) {
  return queryClient.invalidateQueries({ queryKey });
}

// Example API endpoints
export const api = {
  wallet: {
    createWallet: async (token: string, address: string, chain: string) => {
      return fetchApi('/wallets', token, {
        method: 'POST',
        body: JSON.stringify({ address, chain }),
      });
    },
    getWallet: async (token: string): Promise<WalletResponse | null> => {
      const response = await fetchApi<WalletResponse>('/wallets', token, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      return response.data;
    },
  }
  // Add more API endpoints here
};
