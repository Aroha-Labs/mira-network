// Providers supported by AI Gateway Unified Billing
export type Provider = "openai" | "anthropic" | "google-ai-studio" | "groq" | "workers-ai";

export interface ModelInfo {
  id: string;
  provider: Provider;
  providerModel: string; // Model ID for provider API or @cf/* for Workers AI
  promptTokenPrice: number;
  completionTokenPrice: number;
}

// Check if this is a Workers AI model (uses env.AI.run) vs external provider (uses AI Gateway HTTP)
export function isWorkersAI(model: ModelInfo): boolean {
  return model.provider === "workers-ai";
}

export const MODELS: Record<string, ModelInfo> = {
  // OpenAI (via AI Gateway HTTP)
  "gpt-4o": {
    id: "gpt-4o",
    provider: "openai",
    providerModel: "gpt-4o",
    promptTokenPrice: 0.0025,
    completionTokenPrice: 0.01,
  },
  "gpt-4o-mini": {
    id: "gpt-4o-mini",
    provider: "openai",
    providerModel: "gpt-4o-mini",
    promptTokenPrice: 0.00015,
    completionTokenPrice: 0.0006,
  },
  "gpt-4.1": {
    id: "gpt-4.1",
    provider: "openai",
    providerModel: "gpt-4.1",
    promptTokenPrice: 0.002,
    completionTokenPrice: 0.008,
  },
  "o4-mini": {
    id: "o4-mini",
    provider: "openai",
    providerModel: "o4-mini",
    promptTokenPrice: 0.0011,
    completionTokenPrice: 0.0044,
  },

  // Anthropic (via AI Gateway HTTP)
  "claude-3-5-sonnet-20241022": {
    id: "claude-3-5-sonnet-20241022",
    provider: "anthropic",
    providerModel: "claude-3-5-sonnet-20241022",
    promptTokenPrice: 0.003,
    completionTokenPrice: 0.015,
  },
  "claude-sonnet-4-20250514": {
    id: "claude-sonnet-4-20250514",
    provider: "anthropic",
    providerModel: "claude-sonnet-4-20250514",
    promptTokenPrice: 0.003,
    completionTokenPrice: 0.015,
  },

  // Meta Llama (Workers AI - FREE)
  "llama-3.1-8b-instruct": {
    id: "llama-3.1-8b-instruct",
    provider: "workers-ai",
    providerModel: "@cf/meta/llama-3.1-8b-instruct",
    promptTokenPrice: 0,
    completionTokenPrice: 0,
  },
  "llama-3.3-70b-instruct-fp8-fast": {
    id: "llama-3.3-70b-instruct-fp8-fast",
    provider: "workers-ai",
    providerModel: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    promptTokenPrice: 0,
    completionTokenPrice: 0,
  },

  // Qwen (Workers AI - FREE)
  "qwen2.5-coder-32b-instruct": {
    id: "qwen2.5-coder-32b-instruct",
    provider: "workers-ai",
    providerModel: "@cf/qwen/qwen2.5-coder-32b-instruct",
    promptTokenPrice: 0,
    completionTokenPrice: 0,
  },

  // Google (via AI Gateway HTTP)
  "gemini-2.0-flash": {
    id: "gemini-2.0-flash",
    provider: "google-ai-studio",
    providerModel: "gemini-2.0-flash",
    promptTokenPrice: 0.0001,
    completionTokenPrice: 0.0004,
  },

  // Groq (via AI Gateway HTTP - fast inference)
  "llama-3.3-70b-versatile": {
    id: "llama-3.3-70b-versatile",
    provider: "groq",
    providerModel: "llama-3.3-70b-versatile",
    promptTokenPrice: 0.00059,
    completionTokenPrice: 0.00079,
  },
};

export function getModel(modelId: string): ModelInfo | undefined {
  return MODELS[modelId];
}

export function getAllModels() {
  return {
    object: "list",
    data: Object.keys(MODELS).map((id) => ({ id, object: "model" })),
  };
}
