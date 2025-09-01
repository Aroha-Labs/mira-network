import { Provider } from "./provider.base";
import { ProviderConfig } from "./types";
import { FastifyBaseLogger } from "fastify";

export class LiteLLMProvider extends Provider {
  readonly name = "litellm";

  constructor(logger?: FastifyBaseLogger) {
    const config: ProviderConfig = {
      baseUrl: process.env.LITELLM_PROXY_BASE_URL || "http://localhost:4000/v1",
      apiKey: process.env.LITELLM_API_KEY || "",
    };
    super(config, logger);

    if (!config.apiKey) {
      throw new Error("LiteLLM API key is not configured");
    }
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