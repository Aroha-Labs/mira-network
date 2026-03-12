// All models go through AI Gateway -> OpenRouter
// Model format: OpenRouter model IDs

export interface ModelInfo {
  id: string;
  gatewayModel: string; // OpenRouter model ID
  promptTokenPrice: number;
  completionTokenPrice: number;
}

export const MODELS: Record<string, ModelInfo> = {
  // Anthropic
  "claude-haiku-4.5": {
    id: "claude-haiku-4.5",
    gatewayModel: "anthropic/claude-3-5-haiku",
    promptTokenPrice: 0.0008,
    completionTokenPrice: 0.004,
  },

  // OpenAI
  "gpt-5.2": {
    id: "gpt-5.2",
    gatewayModel: "openai/gpt-5.2",
    promptTokenPrice: 0.005,
    completionTokenPrice: 0.015,
  },
  "gpt-4o-mini": {
    id: "gpt-4o-mini",
    gatewayModel: "openai/gpt-4o-mini",
    promptTokenPrice: 0.00015,
    completionTokenPrice: 0.0006,
  },

  // Google
  "gemini-3-flash": {
    id: "gemini-3-flash",
    gatewayModel: "google/gemini-2.5-flash",
    promptTokenPrice: 0.00015,
    completionTokenPrice: 0.0006,
  },

  // DeepSeek
  "deepseek-v3.2": {
    id: "deepseek-v3.2",
    gatewayModel: "deepseek/deepseek-chat",
    promptTokenPrice: 0.00027,
    completionTokenPrice: 0.0011,
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
