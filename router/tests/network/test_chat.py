import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, Mock
import json
from src.mira_client_dashboard.models import ApiToken, ApiLogs, UserCredits, UserCreditsHistory
from sqlalchemy import select

@pytest.fixture
def mock_stream_response():
    return [
        b'data: {"choices":[{"delta":{"content":"Hello"},"finish_reason":null}]}\n',
        b'data: {"choices":[{"delta":{"content":" World"},"finish_reason":null}]}\n',
        b'data: {"choices":[{"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":10,"completion_tokens":20,"total_tokens":30}}\n'
    ]

def test_chat_completion_success(client: TestClient, session, mock_stream_response):
    # Create test API token
    token = ApiToken(
        user_id="test-user-id",
        token="test-token",
        description="Test token"
    )
    session.add(token)
    session.commit()

    print("\nDebug - Created token in DB:", token.token)

    # Create test user credits
    user_credits = UserCredits(
        user_id="test-user-id",
        credits=100.0
    )
    session.add(user_credits)
    session.commit()

    with patch("src.mira_client_dashboard.main.verify_token") as mock_verify, \
         patch("src.mira_client_dashboard.main.get_random_machines") as mock_get_machines, \
         patch("requests.post") as mock_post:

        # Create a Mock object with an 'id' attribute instead of returning a dict
        mock_user = Mock()
        mock_user.id = "test-user-id"
        mock_verify.return_value = mock_user

        # Setup machine mock
        mock_machine = Mock()
        mock_machine.network_ip = "192.168.1.1"
        mock_get_machines.return_value = [mock_machine]

        # Setup streaming response mock
        mock_response = Mock()
        mock_response.iter_lines.return_value = mock_stream_response
        mock_post.return_value = mock_response

        response = client.post(
            "/v1/chat/completions",
            json={
                "model": "test-model",
                "messages": [{"role": "user", "content": "Hello"}],
                "stream": True
            },
            headers={"Authorization": "Bearer test-token"}
        )

        print("Debug - Response status:", response.status_code)
        if response.status_code != 200:
            print("Debug - Response body:", response.json())

        assert response.status_code == 200
        
        # Verify API log was created
        api_log = session.exec(select(ApiLogs)).first()
        assert api_log is not None
        assert api_log.user_id == "test-user-id"
        assert api_log.model == "test-model"
        assert api_log.total_tokens == 30

        # Verify credits were deducted
        updated_credits = session.exec(select(UserCredits)).first()
        assert updated_credits.credits < 100.0  # Credits should be reduced

        # Verify credit history was created
        credit_history = session.exec(select(UserCreditsHistory)).first()
        assert credit_history is not None
        assert credit_history.user_id == "test-user-id"
        assert credit_history.amount < 0  # Should be negative for deduction
