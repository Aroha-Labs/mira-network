chatCompletionGenerateDoc = {
    "description": """Generates a chat completion using the specified model.

### Authentication
- Requires a valid authentication token
- Token must be passed in the Authorization header
- Sufficient credits required for generation

### Request Body
```json
{
    "model": string,
    "model_provider": {
        "base_url": string,
        "api_key": string
    } | null,
    "messages": [
        {
            "role": "system" | "user" | "assistant",
            "content": string
        }
    ],
    "stream": boolean,
    "tools": [
        {
            "type": "function",
            "function": {
                "name": string,
                "description": string,
                "parameters": object
            }
        }
    ] | null,
    "tool_choice": string
}
```

### Response Format (Non-Streaming)
```json
{
    "id": string,
    "object": "chat.completion",
    "created": int,
    "model": string,
    "choices": [
        {
            "index": 0,
            "message": {
                "role": "assistant",
                "content": string,
                "tool_calls": [
                    {
                        "id": string,
                        "type": "function",
                        "function": {
                            "name": string,
                            "arguments": string
                        }
                    }
                ] | null
            },
            "finish_reason": "stop" | "length" | "tool_calls"
        }
    ],
    "usage": {
        "prompt_tokens": int,
        "completion_tokens": int,
        "total_tokens": int
    }
}
```

### Streaming Response Format
Server-sent events with the following data structure:
```json
{
    "content": string | null,
    "tool_calls": [
        {
            "id": string,
            "type": "function",
            "function": {
                "name": string,
                "arguments": string
            },
            "index": int
        }
    ] | null
}
```

### Error Responses
- `400 Bad Request`:
    ```json
    {
        "detail": "Unsupported model"
    }
    ```
- `401 Unauthorized`:
    ```json
    {
        "detail": "Could not validate credentials"
    }
    ```
- `402 Payment Required`:
    ```json
    {
        "detail": "Insufficient credits"
    }
    ```
- `404 Not Found`:
    ```json
    {
        "detail": "User not found"
    }
    ```

### Notes
- Supports both streaming and non-streaming responses
- Automatically tracks usage and deducts credits
- Records performance metrics (TTFT, total response time)
- Distributes requests across available machines
- Supports function calling through tools parameter
- Credits are calculated based on prompt and completion tokens
- Response streaming uses server-sent events (SSE)""",
    "responses": {
        200: {
            "description": "Successfully generated completion",
            "content": {
                "application/json": {
                    "example": {
                        "id": "chatcmpl-123",
                        "object": "chat.completion",
                        "created": 1677858242,
                        "model": "gpt-4",
                        "choices": [
                            {
                                "index": 0,
                                "message": {
                                    "role": "assistant",
                                    "content": "Hello! How can I help you today?",
                                    "tool_calls": None,
                                },
                                "finish_reason": "stop",
                            }
                        ],
                        "usage": {
                            "prompt_tokens": 10,
                            "completion_tokens": 8,
                            "total_tokens": 18,
                        },
                    }
                }
            },
        },
        400: {
            "description": "Invalid request or unsupported model",
            "content": {
                "application/json": {"example": {"detail": "Unsupported model"}}
            },
        },
        401: {
            "description": "Unauthorized - Invalid or missing authentication",
            "content": {
                "application/json": {
                    "example": {"detail": "Could not validate credentials"}
                }
            },
        },
        402: {
            "description": "Insufficient credits",
            "content": {
                "application/json": {"example": {"detail": "Insufficient credits"}}
            },
        },
        404: {
            "description": "User not found",
            "content": {"application/json": {"example": {"detail": "User not found"}}},
        },
    },
}


list_models_doc = {
    "description": """Retrieves a list of all supported language models in the system.

### Authentication
- No authentication required
- Rate limiting may apply

### Response Format
```json
{
    "object": "list",
    "data": [
        {
            "id": string,     // Model identifier
            "object": "model" // Always "model"
        }
    ]
}
```

### Example Models
- `openrouter/meta-llama/llama-3.3-70b-instruct`
- `openai/gpt-4`
- `openrouter/anthropic/claude-3.5-sonnet`

### Notes
- Models are fetched from system settings
- Availability may vary based on system configuration
- Model list is cached and periodically updated
- Returns all models regardless of user access level""",
    "responses": {
        200: {
            "description": "Successfully retrieved models list",
            "content": {
                "application/json": {
                    "example": {
                        "object": "list",
                        "data": [
                            {
                                "id": "openrouter/meta-llama/llama-3.3-70b-instruct",
                                "object": "model",
                            },
                            {"id": "openai/gpt-4", "object": "model"},
                            {
                                "id": "openrouter/anthropic/claude-3.5-sonnet",
                                "object": "model",
                            },
                        ],
                    }
                }
            },
        }
    },
}
