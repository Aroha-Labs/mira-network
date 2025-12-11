import OpenAI from "openai";
import { Message, CompletionOptions, ProviderConfig } from "./types";
import { FastifyBaseLogger } from "fastify";

export abstract class Provider {
  abstract readonly name: string;
  protected client: OpenAI;
  protected logger?: FastifyBaseLogger;

  constructor(protected config: ProviderConfig, logger?: FastifyBaseLogger) {
    this.logger = logger;
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
    });
  }

  async complete(
    model: string,
    messages: Message[],
    options: CompletionOptions = {}
  ): Promise<OpenAI.ChatCompletion | AsyncIterable<OpenAI.ChatCompletionChunk>> {
    try {
      this.logger?.info({
        msg: "Starting completion request",
        provider: this.name,
        model,
        stream: options.stream,
      });

      const response = await this.createCompletion(model, messages, options);

      this.logger?.info({
        msg: "Completion request successful",
        provider: this.name,
        model,
      });

      return response;
    } catch (error: any) {
      this.logger?.error({
        msg: "Completion request failed",
        provider: this.name,
        model,
        error: {
          message: error.message,
          status: error.status,
          type: error.type,
        },
      });
      throw error;
    }
  }

  protected async createCompletion(
    model: string,
    messages: Message[],
    options: CompletionOptions
  ): Promise<OpenAI.ChatCompletion | AsyncIterable<OpenAI.ChatCompletionChunk>> {
    const params: OpenAI.ChatCompletionCreateParams = {
      model,
      messages: messages as OpenAI.ChatCompletionMessageParam[],
      stream: options.stream,
      temperature: options.temperature,
      max_tokens: options.max_tokens,
      top_p: options.top_p,
      frequency_penalty: options.frequency_penalty,
      presence_penalty: options.presence_penalty,
    };

    if (options.reasoning_effort) {
      // For models that support reasoning
      (params as any).reasoning = {
        effort: options.reasoning_effort,
      };
    }

    return await this.client.chat.completions.create(params);
  }
}