import { Provider } from "./provider.base";
import { ProviderConfig } from "./types";
import { FastifyBaseLogger } from "fastify";

export class VLLMProvider extends Provider {
  readonly name = "vllm";

  constructor(baseUrl: string, apiKey: string, logger?: FastifyBaseLogger) {
    const config: ProviderConfig = {
      baseUrl,
      apiKey,
    };
    super(config, logger);
  }

  static canHandle(model: string): boolean {
    return model.startsWith("vllm/");
  }

  static extractModel(model: string): string {
    // Remove "vllm/" prefix
    return model.substring(5);
  }
}