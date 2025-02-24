import pytest
import pytest_asyncio
import httpx
import json
from mira_network import MiraClient, Message, ApiTokenRequest

pytestmark = pytest.mark.asyncio


@pytest_asyncio.fixture
async def client():
    async with MiraClient(api_key="test-key") as client:
        yield client


@pytest.fixture
def mock_response():
    return {"choices": [{"message": {"content": "Hello, world!"}}]}


async def test_client_initialization():
    client = MiraClient(api_key="test-key")
    assert client.api_key == "test-key"
    assert client.base_url == "https://apis.mira.network"

    custom_client = MiraClient(api_key="test-key", base_url="https://custom.url")
    assert custom_client.base_url == "https://custom.url"


async def test_chat_completions_create(client, mock_response, monkeypatch):
    async def mock_post(*args, **kwargs):
        request = httpx.Request("POST", "https://apis.mira.network/v1/chat/completions")
        return httpx.Response(status_code=200, json=mock_response, request=request)

    monkeypatch.setattr(httpx.AsyncClient, "post", mock_post)

    response = await client.chat_completions_create(
        model="test-model", messages=[Message(role="user", content="Hello")]
    )

    assert response == mock_response


async def test_chat_completions_create_streaming(client, monkeypatch):
    responses = [
        b'{"choices":[{"delta":{"content":"Hello"}}]}\n\n',
        b'{"choices":[{"delta":{"content":" World"}}]}\n\n',
        b'{"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n',
    ]
    response_iter = iter(responses)

    async def mock_post(*args, **kwargs):
        request = httpx.Request("POST", "https://apis.mira.network/v1/chat/completions")

        async def aiter_lines():
            for chunk in response_iter:
                yield chunk.decode().strip()

        response = httpx.Response(
            status_code=200,
            headers={"content-type": "text/event-stream"},
            request=request,
        )
        response.aiter_lines = aiter_lines
        return response

    monkeypatch.setattr(httpx.AsyncClient, "post", mock_post)

    stream = await client.chat_completions_create(
        model="test-model",
        messages=[Message(role="user", content="Hello")],
        stream=True,
    )

    chunks = []
    async for chunk in stream:
        # The client's _format_stream_response wraps the line in a choices array
        # So we need to parse the content string as JSON first
        try:
            parsed = json.loads(chunk["choices"][0]["delta"]["content"])
            if parsed["choices"][0]["delta"].get("content"):
                chunks.append(parsed["choices"][0]["delta"]["content"])
        except (json.JSONDecodeError, KeyError):
            continue

    assert chunks == ["Hello", " World"]


async def test_create_api_token(client, monkeypatch):
    mock_token_response = {"token": "new-token"}

    async def mock_post(*args, **kwargs):
        request = httpx.Request("POST", "https://apis.mira.network/v1/api-tokens")
        return httpx.Response(
            status_code=200, json=mock_token_response, request=request
        )

    monkeypatch.setattr(httpx.AsyncClient, "post", mock_post)

    response = await client.create_api_token(ApiTokenRequest(description="Test token"))
    assert response == mock_token_response


async def test_list_api_tokens(client, monkeypatch):
    mock_tokens = [{"token": "token1"}, {"token": "token2"}]

    async def mock_get(*args, **kwargs):
        request = httpx.Request("GET", "https://apis.mira.network/v1/api-tokens")
        return httpx.Response(status_code=200, json=mock_tokens, request=request)

    monkeypatch.setattr(httpx.AsyncClient, "get", mock_get)

    response = await client.list_api_tokens()
    assert response == mock_tokens


async def test_error_handling(client, monkeypatch):
    async def mock_error_response(*args, **kwargs):
        raise httpx.HTTPError("API Error")

    monkeypatch.setattr(httpx.AsyncClient, "post", mock_error_response)

    with pytest.raises(httpx.HTTPError):
        await client.chat_completions_create(
            model="test-model", messages=[Message(role="user", content="Hello")]
        )


async def test_list_models(client, monkeypatch):
    mock_models = {
        "object": "list",
        "data": [
            {"id": "gpt-4o", "object": "model"},
            {"id": "deepseek-r1", "object": "model"},
            {"id": "gpt-4o-mini", "object": "model"},
            {"id": "claude-3.5-sonnet", "object": "model"},
            {"id": "llama-3.3-70b-instruct", "object": "model"}
        ]
    }

    async def mock_get(*args, **kwargs):
        request = httpx.Request("GET", "https://apis.mira.network/v1/models")
        return httpx.Response(status_code=200, json=mock_models, request=request)

    monkeypatch.setattr(httpx.AsyncClient, "get", mock_get)

    response = await client.list_models()
    assert response == mock_models
