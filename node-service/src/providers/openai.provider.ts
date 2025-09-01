import { Provider } from "./provider.base";
import { ProviderConfig } from "./types";
import { FastifyBaseLogger } from "fastify";

export class OpenAIProvider extends Provider {
  readonly name = "openai";

  constructor(logger?: FastifyBaseLogger) {
    const config: ProviderConfig = {
      baseUrl: "https://api.openai.com/v1",
      apiKey: process.env.OPENAI_API_KEY || "",
    };
    super(config, logger);

    if (!config.apiKey) {
      throw new Error("OpenAI API key is not configured");
    }
  }

  static canHandle(model: string): boolean {
    return model.startsWith("openai/");
  }

  static extractModel(model: string): string {
    // Remove "openai/" prefix if present
    if (model.startsWith("openai/")) {
      return model.substring(7);
    }
    return model;
  }
}
