import pytest
from src.mira_sdk.models import (
    Message,
    ModelProvider,
    AiRequest,
    FlowChatCompletion,
    FlowRequest,
    ApiTokenRequest,
    AddCreditRequest,
)


def test_message_model():
    message = Message(role="user", content="Hello!")
    assert message.role == "user"
    assert message.content == "Hello!"


def test_model_provider():
    provider = ModelProvider(base_url="https://mira-client-balancer.alts.dev", api_key="sk-mira-8ac810228d32ff68fc93266fb9a0ba612724119ffab16dcc")
    assert provider.base_url == "https://mira-client-balancer.alts.dev"
    assert provider.api_key == "sk-mira-8ac810228d32ff68fc93266fb9a0ba612724119ffab16dcc"


def test_ai_request():
    messages = [Message(role="user", content="Hello!")]
    provider = ModelProvider(base_url="https://mira-client-balancer.alts.dev", api_key="sk-mira-8ac810228d32ff68fc93266fb9a0ba612724119ffab16dcc")
    
    # Test with default values
    request = AiRequest(messages=messages)
    assert request.model == "mira/llama3.1"
    assert request.stream is False
    assert request.model_provider is None
    assert request.messages == messages
    
    # Test with custom values
    request = AiRequest(
        model="custom/model",
        messages=messages,
        model_provider=provider,
        stream=True
    )
    assert request.model == "custom/model"
    assert request.stream is True
    assert request.model_provider == provider
    assert request.messages == messages


def test_flow_chat_completion():
    # Test with no variables
    completion = FlowChatCompletion()
    assert completion.variables is None
    
    # Test with variables
    variables = {"key": "value"}
    completion = FlowChatCompletion(variables=variables)
    assert completion.variables == variables


def test_flow_request():
    request = FlowRequest(
        system_prompt="You are a helpful assistant",
        name="test-flow"
    )
    assert request.system_prompt == "You are a helpful assistant"
    assert request.name == "test-flow"


def test_api_token_request():
    # Test with no description
    request = ApiTokenRequest()
    assert request.description is None
    
    # Test with description
    request = ApiTokenRequest(description="Test token")
    assert request.description == "Test token"


def test_add_credit_request():
    # Test required fields
    request = AddCreditRequest(user_id="user123", amount=100.0)
    assert request.user_id == "user123"
    assert request.amount == 100.0
    assert request.description is None
    
    # Test with description
    request = AddCreditRequest(
        user_id="user123",
        amount=100.0,
        description="Test credit"
    )
    assert request.user_id == "user123"
    assert request.amount == 100.0
    assert request.description == "Test credit"


def test_invalid_message():
    with pytest.raises(ValueError):
        Message(role="invalid", content="")  # Invalid role


def test_invalid_ai_request():
    with pytest.raises(ValueError):
        AiRequest(messages=[])  # Empty messages list


def test_invalid_add_credit_request():
    with pytest.raises(ValueError):
        AddCreditRequest(user_id="", amount=-100)  # Negative amount
