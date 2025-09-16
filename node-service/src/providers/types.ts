export interface Message {
  role: "system" | "user" | "assistant" | "function";
  content: string;
  name?: string;
}

export interface CompletionOptions {
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  reasoning_effort?: "low" | "medium" | "high";
}

export interface ChatCompletionRequest {
  model: string;
  messages: Message[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  reasoning_effort?: "low" | "medium" | "high";
}

export interface ProviderConfig {
  baseUrl: string;
  apiKey: string;
}