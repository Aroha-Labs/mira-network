import { FastifyBaseLogger } from "fastify";
import { Provider } from "./provider.base";
import { VLLMProvider } from "./vllm.provider";
import { OpenRouterProvider } from "./openrouter.provider";
import { OpenAIProvider } from "./openai.provider";
import { LiteLLMProvider } from "./litellm.provider";

export * from "./types";
export * from "./provider.base";

export class ProviderFactory {
  private static providers = [
    VLLMProvider,
    OpenRouterProvider,
    OpenAIProvider,
    LiteLLMProvider, // Default fallback - should be last
  ];

  static getProvider(model: string, logger?: FastifyBaseLogger): { provider: Provider; modelName: string } {
    if (!model) {
      throw new Error("Model is required");
    }

    // Find the appropriate provider
    for (const ProviderClass of this.providers) {
      if (ProviderClass.canHandle(model)) {
        const provider = new ProviderClass(logger);
        const modelName = ProviderClass.extractModel(model);
        return { provider, modelName };
      }
    }

    // This should never happen as LiteLLM handles everything
    throw new Error(`No provider found for model: ${model}`);
  }

  static listAvailableProviders(): string[] {
    return [
      "vllm/ - Local VLLM instance",
      "openrouter/ - OpenRouter API",
      "openai/ or gpt-* - OpenAI API",
      "Any other - LiteLLM proxy (default)",
    ];
  }
}