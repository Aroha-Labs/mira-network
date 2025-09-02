export const envSchema = {
  type: 'object',
  required: [
    'PORT',
    'LOG_LEVEL',
    'MACHINE_API_TOKEN',
    'ROUTER_BASE_URL',
  ],
  properties: {
    // Server Config
    PORT: { 
      type: 'number',
      minimum: 1,
      maximum: 65535
    },
    LOG_LEVEL: { 
      type: 'string',
      enum: ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']
    },
    
    // Machine Config
    MACHINE_IP: { type: 'string' }, // Optional - auto-detected if not provided
    MACHINE_NAME: { type: 'string' }, // Optional - for identification
    MACHINE_API_TOKEN: { 
      type: 'string',
      minLength: 1
    },
    
    // Router Config
    ROUTER_BASE_URL: { 
      type: 'string'
    },
    
    // VLLM Provider
    VLLM_BASE_URL: { 
      type: 'string'
    },
    VLLM_API_KEY: { type: 'string' },
    
    // OpenRouter Provider
    OPENROUTER_API_KEY: { type: 'string' },
    
    // OpenAI Provider
    OPENAI_API_KEY: { type: 'string' },
    
    // LiteLLM Provider
    LITELLM_API_KEY: { type: 'string' },
    LITELLM_PROXY_BASE_URL: { 
      type: 'string'
    },
    
    // Groq Provider
    GROQ_API_KEY: { type: 'string' },
    GROQ_BASE_URL: { 
      type: 'string'
    },
    
    // Anthropic Provider
    ANTHROPIC_API_KEY: { type: 'string' },
    
    // Other
    VERSION: { type: 'string' },
  },
  additionalProperties: true // Allow other env vars for compatibility
} as const;