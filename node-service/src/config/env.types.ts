export interface EnvConfig {
  // Server Config
  PORT: number;
  LOG_LEVEL: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent';
  
  // Machine Config
  MACHINE_IP?: string; // Optional - auto-detected if not provided
  MACHINE_NAME?: string; // Optional - for identification
  MACHINE_API_TOKEN: string; // Required
  
  // Router Config
  ROUTER_BASE_URL: string; // Required
  
  // VLLM Provider
  VLLM_BASE_URL?: string;
  VLLM_API_KEY?: string;
  
  // OpenRouter Provider
  OPENROUTER_API_KEY?: string;
  
  // OpenAI Provider
  OPENAI_API_KEY?: string;
  
  // LiteLLM Provider
  LITELLM_API_KEY?: string;
  LITELLM_PROXY_BASE_URL?: string;
  
  // Groq Provider
  GROQ_API_KEY?: string;
  GROQ_BASE_URL?: string;
  
  // Anthropic Provider
  ANTHROPIC_API_KEY?: string;
  
  // Security
  SERVICE_ACCESS_TOKEN?: string; // Optional - protects chat endpoint if exposed
  
  // Other
  VERSION?: string;
}

// Declaration merging for Fastify
declare module 'fastify' {
  interface FastifyInstance {
    config: EnvConfig;
  }
}