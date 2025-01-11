import pytest
import httpx
from src.mira_sdk.client import MiraClient
from src.mira_sdk.models import (
    Message,
    AiRequest,
    FlowRequest,
    ApiTokenRequest,
    AddCreditRequest,
)


@pytest.fixture
def client():
    return MiraClient(
        base_url="https://mira-network.alts.dev",
        api_token="sk-mira-b9ecd5f43ef0363e691322df3295c2b98bebd1c1edb0b6d8",
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
    request = AiRequest(
        model="mira/llama3.1",
        messages=[Message(role="user", content="Hi Who are you!")],
        stream=False,
        model_provider=None,
    )

    result = await client.generate(request)
    assert isinstance(result, str)
    assert len(result) > 0


@pytest.mark.asyncio
async def test_generate_stream(client):
    request = AiRequest(
        model="gpt-4o",
        messages=[Message(role="user", content="Hi!")],
        stream=True,
        model_provider=None,
    )
    print("Making generate request with streaming...")
    response = await client.generate(request=request)
    chunks = []
    print("Starting to receive stream chunks...")
    async for chunk in response:
        print(f"Received chunk: {chunk}")
        assert isinstance(chunk, str)
        assert len(chunk) > 0
        chunks.append(chunk)
    print(f"Received {len(chunks)} total chunks")
    assert len(chunks) > 0


@pytest.mark.asyncio
async def test_list_flows(client):
    result = await client.list_flows()
    assert isinstance(result, list)


@pytest.mark.asyncio
async def test_create_and_delete_flow(client):
    # Create flow
    request = FlowRequest(system_prompt="You are a helpful assistant", name="test_flow")

    flow = await client.create_flow(request)
    assert flow.get("name") == "test_flow"

    # Delete the created flow
    flow_id = flow.get("id")
    await client.delete_flow(flow_id)


@pytest.mark.asyncio
async def test_create_api_token(client):
    request = ApiTokenRequest(description="Test token")
    result = await client.create_api_token(request)
    assert "token" in result


@pytest.mark.asyncio
async def test_get_user_credits(client):
    result = await client.get_user_credits()
    assert "amount" in result


@pytest.mark.asyncio
async def test_error_handling(client):
    with pytest.raises(httpx.HTTPError):
        # Test with invalid model name to trigger error
        request = AiRequest(
            model="invalid_model",
            messages=[Message(role="user", content="Hi!")],
            stream=False,
            model_provider=None,
        )
        await client.generate(request)


@pytest.mark.asyncio
async def test_client_context_manager():
    async with MiraClient("https://mira-client-balancer.alts.dev") as client:
        assert isinstance(client._client, httpx.AsyncClient)
