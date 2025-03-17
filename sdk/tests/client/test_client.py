import pytest
import pytest_asyncio
import httpx
import json
import os
from mira_network import MiraClient, Message, ApiTokenRequest
from httpx import ReadTimeout

pytestmark = pytest.mark.asyncio


@pytest.fixture
def client():
    return MiraClient(
        base_url="http://10.147.19.214:9005",
        api_key=os.getenv("STG_API_KEY"),
    )

async def test_client_initialization():
    client = MiraClient(
        api_key=os.getenv("STG_API_KEY"),
        base_url="http://10.147.19.214:9005"
    )
    assert client.api_key == os.getenv("STG_API_KEY")
    assert client.base_url == "http://10.147.19.214:9005"

    custom_client = MiraClient(
        api_key=os.getenv("STG_API_KEY"), 
        base_url="http://10.147.19.214:9005"
    )
    assert custom_client.base_url == "http://10.147.19.214:9005"


# @pytest.mark.integration  # Mark as integration test
async def test_chat_completions_create(client):
    try:
        response = await client.chat_completions_create(
            model="llama-3.3-70b-instruct",
            messages=[Message(role="user", content="Hello")],
            timeout=30.0  # Reduced timeout to 30 seconds
        )
        
        assert "choices" in response
        assert isinstance(response["choices"], list)
        assert "message" in response["choices"][0]
        assert "content" in response["choices"][0]["message"]
    except ReadTimeout:
        pytest.skip("LLM service timed out - skipping test")
    except httpx.HTTPError as e:
        pytest.fail(f"HTTP request failed: {str(e)}")


# @pytest.mark.integration  # Mark as integration test
async def test_chat_completions_create_streaming(client):
    try:
        stream = await client.chat_completions_create(
            model="llama-3.3-70b-instruct",
            messages=[Message(role="user", content="Hello")],
            stream=True,
            timeout=30.0  # Reduced timeout to 30 seconds
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
    except ReadTimeout:
        pytest.skip("LLM service timed out - skipping test")
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
        assert isinstance(response, dict)
        
        # Check pagination fields
        assert "total" in response
        assert "page" in response
        assert "page_size" in response
        assert "total_pages" in response
        assert "items" in response
        
        # Check items array
        assert isinstance(response["items"], list)
        for token in response["items"]:
            assert isinstance(token, dict)
            assert all(key in token for key in ["id", "token", "description", "meta_data", "created_at"])
            assert isinstance(token["id"], int)
            assert isinstance(token["token"], str)
            assert isinstance(token["description"], str)
            assert token["meta_data"] is None or isinstance(token["meta_data"], dict)
            assert isinstance(token["created_at"], str)
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

