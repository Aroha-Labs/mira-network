import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { Readable } from 'stream';
import {
  ChatCompletion,
  ChatCompletionChunk,
  ChatCompletionCreateParams,
  ApiTokenRequest,
  ApiToken,
  UserCredits,
  CreditsHistory,
  Model,
} from './types.js';

export interface MiraConfig {
  apiKey: string;
  baseURL?: string;
  timeout?: number;
  maxRetries?: number;
}

export class MiraClient {
  private client: AxiosInstance;
  private config: MiraConfig;

  constructor(config: MiraConfig) {
    this.config = {
      baseURL: 'https://apis.mira.network',
      timeout: 30000,
      maxRetries: 3,
      ...config,
    };

    this.client = axios.create({
      baseURL: this.config.baseURL,
      timeout: this.config.timeout,
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
    });
  }

  async createChatCompletion(
    params: ChatCompletionCreateParams
  ): Promise<ChatCompletion> {
    try {
      const response = await this.client.post<ChatCompletion>(
        '/v1/chat/completions',
        params
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Mira API error: ${error.response?.data?.error?.message || error.message}`);
      }
      throw error;
    }
  }

  async *createChatCompletionStream(
    params: ChatCompletionCreateParams
  ): AsyncGenerator<ChatCompletionChunk, void, unknown> {
    const response = await this.client.post('/v1/chat/completions',
      { ...params, stream: true },
      { responseType: 'stream' }
    );

    const stream = response.data as Readable;
    let buffer = '';

    for await (const chunk of stream) {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data.trim() === '[DONE]') return;
          try {
            const parsed = JSON.parse(data) as ChatCompletionChunk;
            yield parsed;
          } catch (error) {
            console.error('Error parsing SSE message:', error);
          }
        }
      }
    }
  }

  async listModels(): Promise<Model[]> {
    try {
      const response = await this.client.get<Model[]>('/v1/models');
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Mira API error: ${error.response?.data?.error?.message || error.message}`);
      }
      throw error;
    }
  }

  async createApiToken(request: ApiTokenRequest): Promise<ApiToken> {
    try {
      const response = await this.client.post<ApiToken>('/api-tokens', request);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Mira API error: ${error.response?.data?.error?.message || error.message}`);
      }
      throw error;
    }
  }

  async listApiTokens(): Promise<ApiToken[]> {
    try {
      const response = await this.client.get<ApiToken[]>('/api-tokens');
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Mira API error: ${error.response?.data?.error?.message || error.message}`);
      }
      throw error;
    }
  }

  async deleteApiToken(token: string): Promise<void> {
    try {
      await this.client.delete(`/api-tokens/${token}`);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Mira API error: ${error.response?.data?.error?.message || error.message}`);
      }
      throw error;
    }
  }

  async getUserCredits(): Promise<UserCredits> {
    try {
      const response = await this.client.get<UserCredits>('/user-credits');
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Mira API error: ${error.response?.data?.error?.message || error.message}`);
      }
      throw error;
    }
  }

  async getCreditsHistory(): Promise<CreditsHistory[]> {
    try {
      const response = await this.client.get<CreditsHistory[]>('/user-credits-history');
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Mira API error: ${error.response?.data?.error?.message || error.message}`);
      }
      throw error;
    }
  }
} 
