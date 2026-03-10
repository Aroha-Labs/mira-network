// AI Gateway API Types

export interface GatewayLog {
  id: string;
  created_at: string;
  provider: string;
  model: string;
  tokens_in: number;
  tokens_out: number;
  duration: number;
  success: boolean;
  cached: boolean;
  cost: number;
  metadata?: Record<string, unknown>;
  request_type?: string;
  status_code?: number;
  step?: number;
  path?: string;
}

export interface GatewayLogsResponse {
  result: GatewayLog[];
  success: boolean;
  errors: unknown[];
  messages: unknown[];
  result_info?: {
    page: number;
    per_page: number;
    count: number;
    total_count: number;
  };
}

export interface TransformedLog {
  id: string;
  created_at: string;
  model: string;
  provider: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  total_response_time: number;
  success: boolean;
  cached: boolean;
  cost: number;
  status_code?: number;
  metadata?: Record<string, unknown>;
}

export interface LogsApiResponse {
  logs: TransformedLog[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface MetricsResponse {
  total_requests: number;
  successful_requests: number;
  cached_requests: number;
  success_rate: number;
  cache_rate: number;
  total_tokens_in: number;
  total_tokens_out: number;
  total_tokens: number;
  total_cost: number;
  avg_duration_ms: number;
  model_breakdown: Array<{
    model: string;
    requests: number;
    tokens: number;
    cost: number;
  }>;
}
