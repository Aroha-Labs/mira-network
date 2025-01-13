import pytest
import requests
from src.mira_network.sync_client import MiraSyncClient
from src.mira_network.models import (
    Message,
    AiRequest,
    ApiTokenRequest,
)


@pytest.fixture
def client():
    return MiraSyncClient(
        base_url="https://mira-network.alts.dev",
        api_token="sk-mira-b9ecd5f43ef0363e691322df3295c2b98bebd1c1edb0b6d8",
    )


def test_list_models(client):
    result = client.list_models()
    assert isinstance(result, dict)
    assert result["object"] == "list"
    assert isinstance(result["data"], list)
    assert len(result["data"]) > 0
    assert all(isinstance(model, dict) for model in result["data"])
    assert all("id" in model and "object" in model for model in result["data"])


def test_generate(client):
    request = AiRequest(
        model="gpt-4o",
        messages=[Message(role="user", content="Hi Who are you!")],
        stream=False,
        model_provider=None,
    )

    result = client.generate(request)
    assert isinstance(result, str)
    assert len(result) > 0


def test_generate_stream(client):
    request = AiRequest(
        model="gpt-4o",
        messages=[Message(role="user", content="Hi!")],
        stream=True,
        model_provider=None,
    )
    print("Making generate request with streaming...")
    response = client.generate(request=request)
    chunks = []
    print("Starting to receive stream chunks...")
    for chunk in response:
        print(f"Received chunk: {chunk}")
        assert isinstance(chunk, str)
        assert len(chunk) > 0
        chunks.append(chunk)
    print(f"Received {len(chunks)} total chunks")
    assert len(chunks) > 0


def test_create_api_token(client):
    request = ApiTokenRequest(description="Test token")
    result = client.create_api_token(request)
    assert "token" in result


def test_get_user_credits(client):
    result = client.get_user_credits()
    assert "amount" in result


def test_error_handling(client):
    with pytest.raises(requests.HTTPError):
        # Test with invalid model name to trigger error
        request = AiRequest(
            model="invalid_model",
            messages=[Message(role="user", content="Hi!")],
            stream=False,
            model_provider=None,
        )
        client.generate(request)


def test_client_context_manager():
    with MiraSyncClient("https://mira-network.alts.dev") as client:
        assert isinstance(client._session, requests.Session)
        # Make a test request to ensure session works
        result = client.list_models()
        assert isinstance(result, dict)


def test_list_api_tokens(client):
    tokens = client.list_api_tokens()
    assert isinstance(tokens, list)


def test_get_credits_history(client):
    history = client.get_credits_history()
    assert isinstance(history, list)
