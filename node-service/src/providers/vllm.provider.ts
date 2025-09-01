import { Provider } from "./provider.base";
import { ProviderConfig } from "./types";
import { FastifyBaseLogger } from "fastify";

export class VLLMProvider extends Provider {
  readonly name = "vllm";

  constructor(logger?: FastifyBaseLogger) {
    const config: ProviderConfig = {
      baseUrl: process.env.VLLM_BASE_URL || "http://localhost:8000/v1",
      apiKey: process.env.VLLM_API_KEY || "sk-vllm",
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