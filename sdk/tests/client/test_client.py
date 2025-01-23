import pytest
import pytest_asyncio
import httpx
import json
from mira_network import MiraClient, Message, ApiTokenRequest

pytestmark = pytest.mark.asyncio


@pytest.fixture
def client():
    return MiraClient(
        base_url="http://localhost:8000",
        api_key="sk-mira-test_key",
    )


async def test_client_initialization():
    client = MiraClient(
        api_key="sk-mira-test_key",
        base_url="http://localhost:8000"
    )
    assert client.api_key == "sk-mira-test_key"
    assert client.base_url == "http://localhost:8000"

    custom_client = MiraClient(
        api_key="sk-mira-test_key", 
        base_url="http://localhost:8000"
    )
    assert custom_client.base_url == "http://localhost:8000"


async def test_chat_completions_create(client):
    try:
        response = await client.chat_completions_create(
            model="gpt-4o",
            messages=[Message(role="user", content="Hello")]
        )
        
        assert "choices" in response
        assert isinstance(response["choices"], list)
        assert "message" in response["choices"][0]
        assert "content" in response["choices"][0]["message"]
    except httpx.HTTPError as e:
        pytest.fail(f"HTTP request failed: {str(e)}")


async def test_chat_completions_create_streaming(client):
    try:
        stream = await client.chat_completions_create(
            model="gpt-4o",
            messages=[Message(role="user", content="Hello")],
            stream=True,
        )

        chunks = []
        async for chunk in stream:
            try:
                if chunk["choices"][0]["delta"].get("content"):
                    chunks.append(chunk["choices"][0]["delta"]["content"])
            except (KeyError, TypeError):
                continue

        assert len(chunks) > 0
        assert all(isinstance(chunk, str) for chunk in chunks)
    except httpx.HTTPError as e:
        pytest.fail(f"HTTP request failed: {str(e)}")


async def test_create_api_token(client):
    try:
        response = await client.create_api_token(
            ApiTokenRequest(description="Test token")
        )
        assert "token" in response
        assert isinstance(response["token"], str)
    except httpx.HTTPError as e:
        pytest.fail(f"HTTP request failed: {str(e)}")


async def test_list_api_tokens(client):
    try:
        response = await client.list_api_tokens()
        assert isinstance(response, list)
        for token in response:
            assert isinstance(token, dict)
            assert "token" in token
    except httpx.HTTPError as e:
        pytest.fail(f"HTTP request failed: {str(e)}")


async def test_error_handling(client):
    # Tests error handling for invalid model names
    with pytest.raises(httpx.HTTPError) as exc_info:
        await client.chat_completions_create(
            model="invalid-model",
            messages=[Message(role="user", content="Hello")]
        )
    # The API returns 400 for invalid model names, not 401/404
    assert exc_info.value.response.status_code == 400
