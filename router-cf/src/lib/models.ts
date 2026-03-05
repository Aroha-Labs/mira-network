export interface ModelInfo {
  id: string;
  cfModel: string; // Cloudflare Workers AI model ID
  promptTokenPrice: number;
  completionTokenPrice: number;
}

export const MODELS: Record<string, ModelInfo> = {
  // OpenAI (via AI Gateway)
  "gpt-4o": {
    id: "gpt-4o",
    cfModel: "@cf/openai/gpt-4o",
    promptTokenPrice: 0.0025,
    completionTokenPrice: 0.01,
  },
  "gpt-4o-mini": {
    id: "gpt-4o-mini",
    cfModel: "@cf/openai/gpt-4o-mini",
    promptTokenPrice: 0.00015,
    completionTokenPrice: 0.0006,
  },
  "gpt-5.2": {
    id: "gpt-5.2",
    cfModel: "@cf/openai/gpt-5.2",
    promptTokenPrice: 0.005,
    completionTokenPrice: 0.015,
  },
  "o4-mini": {
    id: "o4-mini",
    cfModel: "@cf/openai/o4-mini",
    promptTokenPrice: 0.0011,
    completionTokenPrice: 0.0044,
  },

  // Anthropic (via AI Gateway)
  "claude-3.5-sonnet": {
    id: "claude-3.5-sonnet",
    cfModel: "@cf/anthropic/claude-3.5-sonnet",
    promptTokenPrice: 0.003,
    completionTokenPrice: 0.015,
  },
  "claude-sonnet-4.5": {
    id: "claude-sonnet-4.5",
    cfModel: "@cf/anthropic/claude-sonnet-4.5",
    promptTokenPrice: 0.003,
    completionTokenPrice: 0.015,
  },

  // DeepSeek (via AI Gateway)
  "deepseek-r1": {
    id: "deepseek-r1",
    cfModel: "@cf/deepseek/deepseek-r1",
    promptTokenPrice: 0.00055,
    completionTokenPrice: 0.00219,
  },
  "deepseek-v3.2": {
    id: "deepseek-v3.2",
    cfModel: "@cf/deepseek/deepseek-v3.2",
    promptTokenPrice: 0.00027,
    completionTokenPrice: 0.0011,
  },

  // Meta Llama (native Workers AI - FREE)
  "llama-3.1-8b-instruct": {
    id: "llama-3.1-8b-instruct",
    cfModel: "@cf/meta/llama-3.1-8b-instruct",
    promptTokenPrice: 0,
    completionTokenPrice: 0,
  },
  "llama-3.3-70b-instruct": {
    id: "llama-3.3-70b-instruct",
    cfModel: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    promptTokenPrice: 0.00059,
    completionTokenPrice: 0.00079,
  },

  // Qwen (native Workers AI)
  "qwen2-1.5b-instruct": {
    id: "qwen2-1.5b-instruct",
    cfModel: "@cf/qwen/qwen2-1.5b-instruct",
    promptTokenPrice: 0.00004,
    completionTokenPrice: 0.00004,
  },
  "qwen-2.5-32b-instruct": {
    id: "qwen-2.5-32b-instruct",
    cfModel: "@cf/qwen/qwen2.5-32b-instruct",
    promptTokenPrice: 0.00029,
    completionTokenPrice: 0.00039,
  },

  // Google (via AI Gateway)
  "gemini-3-flash-preview": {
    id: "gemini-3-flash-preview",
    cfModel: "@cf/google/gemini-3-flash-preview",
    promptTokenPrice: 0.0001,
    completionTokenPrice: 0.0004,
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
