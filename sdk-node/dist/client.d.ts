import { ChatCompletion, ChatCompletionChunk, ChatCompletionCreateParams, ApiTokenRequest, ApiToken, UserCredits, CreditsHistory, Model } from './types.js';
export interface MiraConfig {
    apiKey: string;
    baseURL?: string;
    timeout?: number;
    maxRetries?: number;
}
export declare class MiraClient {
    private client;
    private config;
    constructor(config: MiraConfig);
    createChatCompletion(params: ChatCompletionCreateParams): Promise<ChatCompletion>;
    createChatCompletionStream(params: ChatCompletionCreateParams): AsyncGenerator<ChatCompletionChunk, void, unknown>;
    listModels(): Promise<Model[]>;
    createApiToken(request: ApiTokenRequest): Promise<ApiToken>;
    listApiTokens(): Promise<ApiToken[]>;
    deleteApiToken(token: string): Promise<void>;
    getUserCredits(): Promise<UserCredits>;
    getCreditsHistory(): Promise<CreditsHistory[]>;
}
