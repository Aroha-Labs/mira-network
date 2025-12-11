import { Provider } from "./provider.base";
import { ProviderConfig } from "./types";
import { FastifyBaseLogger } from "fastify";

export class OpenRouterProvider extends Provider {
  readonly name = "openrouter";

  constructor(apiKey: string, logger?: FastifyBaseLogger) {
    const config: ProviderConfig = {
      baseUrl: "https://openrouter.ai/api/v1",
      apiKey,
    };
    super(config, logger);
  }

  static canHandle(model: string): boolean {
    return model.startsWith("openrouter/");
  }

  static extractModel(model: string): string {
    // Remove "openrouter/" prefix
    return model.substring(11);
  }
}