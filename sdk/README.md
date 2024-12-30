# Mira SDK

A Python SDK for interacting with the Mira Network API. This SDK provides a simple interface to access all Mira API endpoints including model inference, flow management, and credit system.

## Installation

```bash
pip install mira-sdk
```

## Quick Start

```python
import asyncio
from mira_sdk import MiraClient, Message, AiRequest

async def main():
    # Initialize client
    client = MiraClient(
        base_url="https://api.mira.example.com",
        api_token="your-api-token"
    )
    
    # List available models
    models = await client.list_models()
    print("Available models:", models)
    
    # Generate text
    request = AiRequest(
        model="mira/llama3.1",
        messages=[
            Message(role="system", content="You are a helpful assistant."),
            Message(role="user", content="Hello!")
        ],
        model_provider=None
    )
    
    response = await client.generate(request)
    print("Response:", response)

if __name__ == "__main__":
    asyncio.run(main())
```

## Features

- Asynchronous API using `httpx`
- Full type hints support
- Pydantic models for request/response validation
- Support for all Mira API endpoints:
  - Model inference
  - Flow management
  - API token management
  - Credit system

## API Reference

### Models

- `Message`: Represents a chat message
- `ModelProvider`: Configuration for custom model providers
- `AiRequest`: Request for model inference
- `FlowChatCompletion`: Request for flow-based chat completion
- `FlowRequest`: Request for creating/updating flows
- `ApiTokenRequest`: Request for creating API tokens
- `AddCreditRequest`: Request for adding credits

### Client Methods

#### Model Operations
- `list_models()`: List available models
- `generate(request: AiRequest)`: Generate text using specified model

#### Flow Operations
- `list_flows()`: List all flows
- `get_flow(flow_id: str)`: Get flow details
- `create_flow(request: FlowRequest)`: Create new flow
- `update_flow(flow_id: str, request: FlowRequest)`: Update flow
- `delete_flow(flow_id: str)`: Delete flow
- `generate_with_flow(flow_id: str, request: FlowChatCompletion)`: Generate using flow

#### Token Operations
- `create_api_token(request: ApiTokenRequest)`: Create API token
- `list_api_tokens()`: List API tokens
- `delete_api_token(token: str)`: Delete API token

#### Credit Operations
- `get_user_credits()`: Get credit information
- `add_credit(request: AddCreditRequest)`: Add credits
- `get_credits_history()`: Get credit history

## License

MIT License
