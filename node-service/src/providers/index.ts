import { FastifyBaseLogger } from "fastify";
import { Provider } from "./provider.base";
import { VLLMProvider } from "./vllm.provider";
import { OpenRouterProvider } from "./openrouter.provider";
import { OpenAIProvider } from "./openai.provider";
import { LiteLLMProvider } from "./litellm.provider";
import { EnvConfig } from "../config";

export * from "./types";
export * from "./provider.base";

export class ProviderFactory {
  static getProvider(
    model: string,
    config: EnvConfig,
    logger?: FastifyBaseLogger
  ): { provider: Provider; modelName: string } {
    if (!model) {
      throw new Error("Model is required");
    }

    // Check for VLLM
    if (VLLMProvider.canHandle(model)) {
      if (!config.VLLM_BASE_URL || !config.VLLM_API_KEY) {
        throw new Error(
          "VLLM provider requested but VLLM_BASE_URL and VLLM_API_KEY not configured"
        );
      }
      return {
        provider: new VLLMProvider(config.VLLM_BASE_URL, config.VLLM_API_KEY, logger),
        modelName: VLLMProvider.extractModel(model),
      };
    }

    // Check for OpenRouter
    if (OpenRouterProvider.canHandle(model)) {
      if (!config.OPENROUTER_API_KEY) {
        throw new Error(
          "OpenRouter provider requested but OPENROUTER_API_KEY not configured"
        );
      }
      return {
        provider: new OpenRouterProvider(config.OPENROUTER_API_KEY, logger),
        modelName: OpenRouterProvider.extractModel(model),
      };
    }

    // Check for OpenAI
    if (OpenAIProvider.canHandle(model)) {
      if (!config.OPENAI_API_KEY) {
        throw new Error(
          "OpenAI provider requested but OPENAI_API_KEY not configured"
        );
      }
      return {
        provider: new OpenAIProvider(config.OPENAI_API_KEY, logger),
        modelName: OpenAIProvider.extractModel(model),
      };
    }

    // Default to LiteLLM
    if (!config.LITELLM_API_KEY || !config.LITELLM_PROXY_BASE_URL) {
      throw new Error(
        "LiteLLM provider requested but LITELLM_API_KEY and LITELLM_PROXY_BASE_URL not configured"
      );
    }
    return {
      provider: new LiteLLMProvider(config.LITELLM_PROXY_BASE_URL, config.LITELLM_API_KEY, logger),
      modelName: LiteLLMProvider.extractModel(model),
    };
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