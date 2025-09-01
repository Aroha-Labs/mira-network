import { Provider } from "./provider.base";
import { ProviderConfig } from "./types";
import { FastifyBaseLogger } from "fastify";

export class OpenRouterProvider extends Provider {
  readonly name = "openrouter";

  constructor(logger?: FastifyBaseLogger) {
    const config: ProviderConfig = {
      baseUrl: "https://openrouter.ai/api/v1",
      apiKey: process.env.OPENROUTER_API_KEY || "",
    };
    super(config, logger);

    if (!config.apiKey) {
      throw new Error("OpenRouter API key is not configured");
    }
  }

  static canHandle(model: string): boolean {
    return model.startsWith("openrouter/");
  }

  static extractModel(model: string): string {
    // Remove "openrouter/" prefix
    return model.substring(11);
  }
}