export type ChatCompletionMessage = {
    role: 'system' | 'user' | 'assistant' | 'function';
    content: string | null;
    name?: string;
    function_call?: {
        name: string;
        arguments: string;
    };
};
export type ChatCompletionCreateParams = {
    messages: ChatCompletionMessage[];
    model: string;
    temperature?: number;
    top_p?: number;
    n?: number;
    stream?: boolean;
    stop?: string | string[];
    max_tokens?: number;
    presence_penalty?: number;
    frequency_penalty?: number;
    logit_bias?: Record<string, number>;
    user?: string;
    functions?: Array<{
        name: string;
        description?: string;
        parameters: Record<string, any>;
    }>;
    function_call?: 'auto' | 'none' | {
        name: string;
    };
};
export type ChatCompletion = {
    id: string;
    object: 'chat.completion';
    created: number;
    model: string;
    choices: Array<{
        index: number;
        message: ChatCompletionMessage;
        finish_reason: 'stop' | 'length' | 'function_call' | 'content_filter';
    }>;
    usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
};
export type ChatCompletionChunk = {
    id: string;
    object: 'chat.completion.chunk';
    created: number;
    model: string;
    choices: Array<{
        index: number;
        delta: Partial<ChatCompletionMessage>;
        finish_reason: 'stop' | 'length' | 'function_call' | 'content_filter' | null;
    }>;
};
export interface ApiTokenRequest {
    name: string;
    expiration?: string;
    permissions?: string[];
}
export interface ApiToken {
    id: string;
    name: string;
    token: string;
    created_at: string;
    expires_at?: string;
    permissions: string[];
}
export interface UserCredits {
    available: number;
    used: number;
    total: number;
}
export interface CreditsHistory {
    id: string;
    amount: number;
    type: 'credit' | 'debit';
    description: string;
    created_at: string;
}
export interface Model {
    id: string;
    name: string;
    description?: string;
    max_tokens: number;
    pricing: {
        input: number;
        output: number;
    };
}
