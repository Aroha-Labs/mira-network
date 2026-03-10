export interface ApiLog {
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
  ttft?: number; // Time to first token - not available from AI Gateway
}

export interface ApiLogsResponse {
  logs: ApiLog[];
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
