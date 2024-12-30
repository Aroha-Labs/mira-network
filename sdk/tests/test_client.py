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
        base_url="https://mira-client-balancer.alts.dev",
        api_token="sk-mira-8ac810228d32ff68fc93266fb9a0ba612724119ffab16dcc"
    )


@pytest.mark.asyncio
async def test_list_models(client):
    result = await client.list_models()
    assert isinstance(result, list)
    # assert len(result) > 0


@pytest.mark.asyncio
async def test_generate(client):
    request = AiRequest(
        model="mira/llama3.1",
        messages=[Message(role="user", content="Hi Who are you!")],
        stream=False,
        model_provider=None
    )
    
    result = await client.generate(request)
    assert isinstance(result, str)
    assert len(result) > 0


@pytest.mark.asyncio
async def test_generate_stream(client):
    request = AiRequest(
        model="mira/llama3.1",
        messages=[Message(role="user", content="Hi!")],
        stream=True,
        model_provider=None
    )
    
    stream = await client.generate(request)
    chunks = []
    async for chunk in stream:
        chunks.append(chunk)
    assert len(chunks) > 0


@pytest.mark.asyncio
async def test_list_flows(client):
    result = await client.list_flows()
    assert isinstance(result, list)


@pytest.mark.asyncio
async def test_create_and_delete_flow(client):
    # Create flow
    request = FlowRequest(
        system_prompt="You are a helpful assistant",
        name="test_flow"
    )
    
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
            model_provider=None
        )
        await client.generate(request)


@pytest.mark.asyncio
async def test_client_context_manager():
    async with MiraClient("https://mira-client-balancer.alts.dev") as client:
        assert isinstance(client._client, httpx.AsyncClient)
