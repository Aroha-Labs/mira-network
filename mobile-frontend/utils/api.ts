import { QueryClient } from "@tanstack/react-query";
import { WalletResponse } from "@/types/wallet";

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

// Chat types
export interface Thread {
  id: string;
  title: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  thread_metadata: Record<string, any>;
  is_archived: boolean;
}

export interface Message {
  id: string;
  thread_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  tool_calls?: any[];
  created_at: string;
  message_metadata: Record<string, any>;
  parent_message_id?: string;
}

export interface CreateMessageRequest {
  content: string;
  thread_id?: string;
  role?: "user" | "assistant" | "system";
  model?: string;
  stream?: boolean;
  tool_calls?: any[];
  parent_message_id?: string;
  metadata?: Record<string, any>;
}

// Fetch wrapper with type safety
export async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {},
  queryParams?: Record<string, string>
): Promise<ApiResponse<T>> {
  try {
    const url = new URL(`${API_BASE_URL}${endpoint}`);
    if (queryParams) {
      Object.entries(queryParams).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }

    const response = await fetch(url.toString(), {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw {
        message: data.detail || "An error occurred",
        status: response.status,
      };
    }

    return {
      data,
      status: response.status,
    };
  } catch (error) {
    throw {
      message: error.message || "An error occurred",
      status: error.status || 500,
    };
  }
}

// Utility function to invalidate queries
export function invalidateQueries(
  queryClient: QueryClient,
  queryKey: string[]
) {
  queryClient.invalidateQueries({ queryKey });
}

// API endpoints
export const api = {
  wallet: {
    createWallet: async (
      token: string,
      address: string,
      chain: string
    ): Promise<ApiResponse<WalletResponse>> => {
      return fetchApi("/v1/wallet", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ address, chain }),
      });
    },

    getWallet: async (token: string): Promise<WalletResponse | null> => {
      try {
        const response = await fetchApi<WalletResponse>("/wallets", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        return response.data;
      } catch (error) {
        if (error.status === 404) return null;
        throw error;
      }
    },
  },

  chat: {
    // Thread operations
    listThreads: async (token: string, page = 1, limit = 10) => {
      return fetchApi<Thread[]>(
        "/v1/threads",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
        {
          skip: ((page - 1) * limit).toString(),
          limit: limit.toString(),
        }
      );
    },

    getThread: async (token: string, threadId: string) => {
      return fetchApi<Thread>(`/v1/threads/${threadId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    },

    archiveThread: async (token: string, threadId: string) => {
      return fetchApi(`/v1/threads/${threadId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    },

    // Message operations
    createMessage: async (token: string, message: CreateMessageRequest) => {
      return fetchApi<Message>("/v1/messages", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(message),
      });
    },

    listMessages: async (
      token: string,
      threadId: string,
      page = 1,
      limit = 50
    ) => {
      return fetchApi<Message[]>(
        `/v1/threads/${threadId}/messages`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
        {
          skip: ((page - 1) * limit).toString(),
          limit: limit.toString(),
        }
      );
    },

    // Streaming message support
    createStreamingMessage: async (
      token: string,
      message: CreateMessageRequest,
      onChunk: (chunk: string) => void
    ) => {
      const response = await fetch(`${API_BASE_URL}/v1/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({ ...message, stream: true }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw {
          message: error.detail || "An error occurred",
          status: response.status,
        };
      }

      // Get thread ID from headers
      const threadId = response.headers.get("X-Thread-Id");
      let responseData = { thread_id: threadId };

      try {
        // For React Native, we need to use text() instead of body.getReader()
        const text = await response.text();
        const lines = text.split("\n");

        let buffer = "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              // Handle content chunks
              if (data.choices?.[0]?.delta?.content) {
                const content = data.choices[0].delta.content;
                buffer += content;
                onChunk(content);
              }
              // Handle thread ID in final message
              if (data.thread_id) {
                responseData.thread_id = data.thread_id;
              }
              // Handle any errors
              if (data.error) {
                throw new Error(data.error);
              }
            } catch (e) {
              if (e instanceof SyntaxError) {
                // Skip invalid JSON
                continue;
              }
              throw e;
            }
          }
        }

        return { data: responseData };
      } catch (error) {
        console.error("Error in streaming:", error);
        throw error;
      }
    },
  },
};
