import { Provider } from "./provider.base";
import { ProviderConfig } from "./types";
import { FastifyBaseLogger } from "fastify";

export class OpenAIProvider extends Provider {
  readonly name = "openai";

  constructor(apiKey: string, logger?: FastifyBaseLogger) {
    const config: ProviderConfig = {
      baseUrl: "https://api.openai.com/v1",
      apiKey,
    };
    super(config, logger);
  }

  static canHandle(model: string): boolean {
    return model.startsWith("openai/") || model.startsWith("gpt-");
  }

  static extractModel(model: string): string {
    // Remove "openai/" prefix if present
    if (model.startsWith("openai/")) {
      return model.substring(7);
    }
    return model;
  }
}
