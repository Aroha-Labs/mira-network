import { Provider } from "./provider.base";
import { ProviderConfig } from "./types";
import { FastifyBaseLogger } from "fastify";

export class LiteLLMProvider extends Provider {
  readonly name = "litellm";

  constructor(baseUrl: string, apiKey: string, logger?: FastifyBaseLogger) {
    const config: ProviderConfig = {
      baseUrl,
      apiKey,
    };
    super(config, logger);
  }

  static canHandle(model: string): boolean {
    // LiteLLM is the default fallback
    return true;
  }

  static extractModel(model: string): string {
    // LiteLLM handles model routing internally
    return model;
  }
}