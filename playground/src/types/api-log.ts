import { Message } from "src/utils/chat";

export interface ModelPricing {
  label: string;
  prompt_token: number;
  completion_token: number;
}

export interface ApiLog {
  id: number;
  user_id: string;
  payload: {
    messages: Message[];
  };
  request_payload?: Record<string, unknown>;
  ttft: number;
  response: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  total_response_time: number;
  model: string;
  model_pricing?: ModelPricing;
  machine_id?: string;
  created_at: string;
}

export interface ApiLogsResponse {
  logs: ApiLog[];
  page: number;
  page_size: number;
  total: number;
}
