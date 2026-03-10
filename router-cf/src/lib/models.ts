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
  "gpt-5.2": {
    id: "gpt-5.2",
    gatewayModel: "openai/gpt-5.2",
    promptTokenPrice: 0.005,
    completionTokenPrice: 0.015,
  },
  "o4-mini": {
    id: "o4-mini",
    gatewayModel: "openai/o4-mini",
    promptTokenPrice: 0.0011,
    completionTokenPrice: 0.0044,
  },

  // Anthropic
  "claude-3.5-sonnet": {
    id: "claude-3.5-sonnet",
    gatewayModel: "anthropic/claude-3-5-sonnet-latest",
    promptTokenPrice: 0.003,
    completionTokenPrice: 0.015,
  },
  "claude-sonnet-4.5": {
    id: "claude-sonnet-4.5",
    gatewayModel: "anthropic/claude-sonnet-4-5-20250514",
    promptTokenPrice: 0.003,
    completionTokenPrice: 0.015,
  },

  // DeepSeek
  "deepseek-r1": {
    id: "deepseek-r1",
    gatewayModel: "deepseek/deepseek-reasoner",
    promptTokenPrice: 0.00055,
    completionTokenPrice: 0.00219,
  },
  "deepseek-v3.2": {
    id: "deepseek-v3.2",
    gatewayModel: "deepseek/deepseek-chat",
    promptTokenPrice: 0.00027,
    completionTokenPrice: 0.0011,
  },

  // Google
  "gemini-3-flash-preview": {
    id: "gemini-3-flash-preview",
    gatewayModel: "google-ai-studio/gemini-2.5-flash-preview-05-20",
    promptTokenPrice: 0.00015,
    completionTokenPrice: 0.0006,
  },

  // Workers AI (FREE)
  "llama-3.1-8b-instruct": {
    id: "llama-3.1-8b-instruct",
    gatewayModel: "workers-ai/@cf/meta/llama-3.1-8b-instruct",
    promptTokenPrice: 0,
    completionTokenPrice: 0,
  },
  "llama-3.3-70b-instruct": {
    id: "llama-3.3-70b-instruct",
    gatewayModel: "workers-ai/@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    promptTokenPrice: 0,
    completionTokenPrice: 0,
  },
  "qwen2-1.5b-instruct": {
    id: "qwen2-1.5b-instruct",
    gatewayModel: "workers-ai/@cf/qwen/qwen1.5-1.8b-chat",
    promptTokenPrice: 0,
    completionTokenPrice: 0,
  },
  "qwen-2.5-32b-instruct": {
    id: "qwen-2.5-32b-instruct",
    gatewayModel: "workers-ai/@cf/qwen/qwen2.5-coder-32b-instruct",
    promptTokenPrice: 0,
    completionTokenPrice: 0,
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
