// All models go through AI Gateway /compat endpoint
// Model format for gateway: "provider/model-name" or "workers-ai/@cf/..."

export interface ModelInfo {
  id: string;
  gatewayModel: string; // Model ID in gateway format: "provider/model"
  promptTokenPrice: number;
  completionTokenPrice: number;
}

export const MODELS: Record<string, ModelInfo> = {
  // OpenAI
  "gpt-4o": {
    id: "gpt-4o",
    gatewayModel: "openai/gpt-4o",
    promptTokenPrice: 0.0025,
    completionTokenPrice: 0.01,
  },
  "gpt-4o-mini": {
    id: "gpt-4o-mini",
    gatewayModel: "openai/gpt-4o-mini",
    promptTokenPrice: 0.00015,
    completionTokenPrice: 0.0006,
  },
  "gpt-4.1": {
    id: "gpt-4.1",
    gatewayModel: "openai/gpt-4.1",
    promptTokenPrice: 0.002,
    completionTokenPrice: 0.008,
  },
  "o4-mini": {
    id: "o4-mini",
    gatewayModel: "openai/o4-mini",
    promptTokenPrice: 0.0011,
    completionTokenPrice: 0.0044,
  },

  // Anthropic
  "claude-3-5-sonnet-20241022": {
    id: "claude-3-5-sonnet-20241022",
    gatewayModel: "anthropic/claude-3-5-sonnet-20241022",
    promptTokenPrice: 0.003,
    completionTokenPrice: 0.015,
  },
  "claude-sonnet-4-20250514": {
    id: "claude-sonnet-4-20250514",
    gatewayModel: "anthropic/claude-sonnet-4-20250514",
    promptTokenPrice: 0.003,
    completionTokenPrice: 0.015,
  },

  // Workers AI (FREE) - format: workers-ai/@cf/...
  "llama-3.1-8b-instruct": {
    id: "llama-3.1-8b-instruct",
    gatewayModel: "workers-ai/@cf/meta/llama-3.1-8b-instruct",
    promptTokenPrice: 0,
    completionTokenPrice: 0,
  },
  "llama-3.3-70b-instruct-fp8-fast": {
    id: "llama-3.3-70b-instruct-fp8-fast",
    gatewayModel: "workers-ai/@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    promptTokenPrice: 0,
    completionTokenPrice: 0,
  },
  "qwen2.5-coder-32b-instruct": {
    id: "qwen2.5-coder-32b-instruct",
    gatewayModel: "workers-ai/@cf/qwen/qwen2.5-coder-32b-instruct",
    promptTokenPrice: 0,
    completionTokenPrice: 0,
  },

  // Google AI Studio
  "gemini-2.0-flash": {
    id: "gemini-2.0-flash",
    gatewayModel: "google-ai-studio/gemini-2.0-flash",
    promptTokenPrice: 0.0001,
    completionTokenPrice: 0.0004,
  },

  // Groq (fast inference)
  "llama-3.3-70b-versatile": {
    id: "llama-3.3-70b-versatile",
    gatewayModel: "groq/llama-3.3-70b-versatile",
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
