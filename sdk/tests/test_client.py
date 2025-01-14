import pytest
from src.mira_network.client import MiraClient
from src.mira_network.models import (
    Message,
    ApiTokenRequest,
)


@pytest.fixture
def client():
    return MiraClient(
        base_url="https://mira-network.alts.dev",
        api_key="sk-mira-b9ecd5f43ef0363e691322df3295c2b98bebd1c1edb0b6d8",
    )


@pytest.mark.asyncio
async def test_list_models(client):
    result = await client.list_models()
    assert isinstance(result, dict)
    assert result["object"] == "list"
    assert isinstance(result["data"], list)
    assert len(result["data"]) > 0
    assert all(isinstance(model, dict) for model in result["data"])
    assert all("id" in model and "object" in model for model in result["data"])


@pytest.mark.asyncio
async def test_generate(client):
    for _ in range(3):
        try:
            result = await client.chat_completions_create(
                model="gpt-4o",
                messages=[Message(role="user", content="Hi Who are you!")],
                stream=False,
            )
            assert len(result) > 0
            return  # Success, exit the loop
        except Exception as e:
            print(f"Attempt failed: {e}")
    pytest.fail("All attempts failed")


@pytest.mark.asyncio
async def test_generate_stream(client):
    print("Making generate request with streaming...")
    response = await client.chat_completions_create(
        model="gpt-4o",
        messages=[Message(role="user", content="Hi Who are you!")],
        stream=True,
    )
    chunks = []
    print("Starting to receive stream chunks...")
    async for chunk in response:
        print(f"Received chunk: {chunk}")
        assert isinstance(chunk["choices"][0], dict)
        assert "delta" in chunk["choices"][0]
        chunks.append(chunk)
    print(f"Received {len(chunks)} total chunks")
    assert len(chunks) > 0


@pytest.mark.asyncio
async def test_create_api_token(client):
    request = ApiTokenRequest(description="Test token")
    result = await client.create_api_token(request)
    assert "token" in result


@pytest.mark.asyncio
async def test_get_user_credits(client):
    result = await client.get_user_credits()
    assert isinstance(result, dict)
