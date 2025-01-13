# Mira Network SDK

A Python SDK for interacting with the Mira Network API. This SDK provides both synchronous and asynchronous interfaces to access Mira API endpoints for model inference, API token management, and credit system operations.

## Installation

```bash
pip install mira-network
```

## Quick Start

### Synchronous Usage

```python
from mira_network.sync_client import MiraSyncClient
from mira_network.models import AiRequest, Message

# Using context manager (recommended)
with MiraSyncClient(api_token="your-api-token") as client:  # base_url defaults to https://apis.mira.network/
    # Example 1: Non-streaming response
    request = AiRequest(
        messages=[
            Message(role="system", content="You are a helpful assistant."),
            Message(role="user", content="Hello!")
        ],
        stream=False
    )
    response = client.generate(request)
    print(response)
    
    # Example 2: Streaming response
    stream_request = AiRequest(
        messages=[
            Message(role="system", content="You are a helpful assistant."),
            Message(role="user", content="Tell me a story!")
        ],
        stream=True
    )
    for chunk in client.generate(stream_request):
        print(chunk)
```

### Asynchronous Usage

```python
import asyncio
from mira_network.client import MiraClient
from mira_network.models import AiRequest, Message

async def main():
    # Using async context manager (recommended)
    async with MiraClient(api_token="your-api-token") as client:  # base_url defaults to https://apis.mira.network/
        # Example 1: Non-streaming response
        request = AiRequest(
            messages=[
                Message(role="system", content="You are a helpful assistant."),
                Message(role="user", content="Hello!")
            ],
            model="gpt-4o",
            model_provider=None,
            stream=False
        )
        response = await client.generate(request)
        print(response)
        
        # Example 2: Streaming response
        stream_request = AiRequest(
            messages=[
                Message(role="system", content="You are a helpful assistant."),
                Message(role="user", content="Tell me a story!")
            ],
            stream=True
        )
        async for chunk in await client.generate(stream_request):
            print(chunk)

if __name__ == "__main__":
    asyncio.run(main())
```

## API Reference

### Client Initialization

The SDK provides two client classes:
- `MiraSyncClient`: Synchronous client using `requests`
- `MiraClient`: Asynchronous client using `httpx`

Both clients support context managers for proper resource cleanup:

```python
# Synchronous
with MiraSyncClient(
    api_token="your-api-token",
    base_url="https://apis.mira.network/"  # Optional, this is the default
) as client:
    # Your sync code here

# Asynchronous
async with MiraClient(
    api_token="your-api-token",
    base_url="https://apis.mira.network/"  # Optional, this is the default
) as client:
    # Your async code here
```

### Models

- `Message`: Represents a chat message
  - `role`: String ("system", "user", or "assistant")
  - `content`: String content of the message

- `AiRequest`: Configuration for model inference
  - `model`: Model identifier (default: "mira/llama3.1")
  - `messages`: List of Message objects
  - `stream`: Boolean to enable streaming responses (default: False)
  - `model_provider`: Optional ModelProvider configuration

- `ModelProvider`: Custom provider configuration
  - `base_url`: Provider's base URL
  - `api_key`: Provider's API key

- `ApiTokenRequest`: Request for creating API tokens
  - `description`: Optional description for the token

### Available Methods

Both sync and async clients provide the same methods with identical parameters. The only difference is that async methods must be awaited.

#### Model Operations
```python
# Sync
models = client.list_models()
response = client.generate(AiRequest(messages=[...], stream=False))
for chunk in client.generate(AiRequest(messages=[...], stream=True)):
    print(chunk)

# Async
models = await client.list_models()
response = await client.generate(AiRequest(messages=[...], stream=False))
async for chunk in await client.generate(AiRequest(messages=[...], stream=True)):
    print(chunk)
```

#### API Token Operations
```python
# Sync
token = client.create_api_token(ApiTokenRequest(description="My Token"))
tokens = client.list_api_tokens()
client.delete_api_token("token-to-delete")

# Async
token = await client.create_api_token(ApiTokenRequest(description="My Token"))
tokens = await client.list_api_tokens()
await client.delete_api_token("token-to-delete")
```

#### Credit Operations
```python
# Sync
credits = client.get_user_credits()
history = client.get_credits_history()

# Async
credits = await client.get_user_credits()
history = await client.get_credits_history()
```

## License

MIT License
