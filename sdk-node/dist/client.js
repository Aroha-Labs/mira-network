import axios from 'axios';
export class MiraClient {
    client;
    config;
    constructor(config) {
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
    async createChatCompletion(params) {
        try {
            const response = await this.client.post('/v1/chat/completions', params);
            return response.data;
        }
        catch (error) {
            if (axios.isAxiosError(error)) {
                throw new Error(`Mira API error: ${error.response?.data?.error?.message || error.message}`);
            }
            throw error;
        }
    }
    async *createChatCompletionStream(params) {
        const response = await this.client.post('/v1/chat/completions', { ...params, stream: true }, { responseType: 'stream' });
        const stream = response.data;
        let buffer = '';
        for await (const chunk of stream) {
            buffer += chunk.toString();
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data.trim() === '[DONE]')
                        return;
                    try {
                        const parsed = JSON.parse(data);
                        yield parsed;
                    }
                    catch (error) {
                        console.error('Error parsing SSE message:', error);
                    }
                }
            }
        }
    }
    async listModels() {
        try {
            const response = await this.client.get('/v1/models');
            return response.data;
        }
        catch (error) {
            if (axios.isAxiosError(error)) {
                throw new Error(`Mira API error: ${error.response?.data?.error?.message || error.message}`);
            }
            throw error;
        }
    }
    async createApiToken(request) {
        try {
            const response = await this.client.post('/api-tokens', request);
            return response.data;
        }
        catch (error) {
            if (axios.isAxiosError(error)) {
                throw new Error(`Mira API error: ${error.response?.data?.error?.message || error.message}`);
            }
            throw error;
        }
    }
    async listApiTokens() {
        try {
            const response = await this.client.get('/api-tokens');
            return response.data;
        }
        catch (error) {
            if (axios.isAxiosError(error)) {
                throw new Error(`Mira API error: ${error.response?.data?.error?.message || error.message}`);
            }
            throw error;
        }
    }
    async deleteApiToken(token) {
        try {
            await this.client.delete(`/api-tokens/${token}`);
        }
        catch (error) {
            if (axios.isAxiosError(error)) {
                throw new Error(`Mira API error: ${error.response?.data?.error?.message || error.message}`);
            }
            throw error;
        }
    }
    async getUserCredits() {
        try {
            const response = await this.client.get('/user-credits');
            return response.data;
        }
        catch (error) {
            if (axios.isAxiosError(error)) {
                throw new Error(`Mira API error: ${error.response?.data?.error?.message || error.message}`);
            }
            throw error;
        }
    }
    async getCreditsHistory() {
        try {
            const response = await this.client.get('/user-credits-history');
            return response.data;
        }
        catch (error) {
            if (axios.isAxiosError(error)) {
                throw new Error(`Mira API error: ${error.response?.data?.error?.message || error.message}`);
            }
            throw error;
        }
    }
}
