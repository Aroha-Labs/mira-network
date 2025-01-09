import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, Mock, AsyncMock
from src.mira_client_dashboard.models import ApiLogs, UserCredits, UserCreditsHistory
from sqlmodel import select
from datetime import datetime, timezone
import json
import os

@pytest.fixture
def mock_user():
    mock = Mock()
    mock.id = "test-user-id"
    return mock

@pytest.fixture
def mock_machine():
    mock = Mock()
    mock.network_ip = "192.168.1.1"
    mock.model_dump = lambda: {"network_ip": "192.168.1.1"}
    return mock

@pytest.fixture
def user_credits(session):
    credits = UserCredits(
        id=1,
        user_id="test-user-id",
        credits=100.0
    )
    session.add(credits)
    session.commit()
    return credits

def test_verify_endpoint(client: TestClient, mock_machine):
    with patch("src.mira_client_dashboard.api.v1.network.get_random_machines") as mock_get_machines, \
         patch("src.mira_client_dashboard.api.v1.network.httpx.AsyncClient.post") as mock_post:
        
        # Setup mocks
        mock_get_machines.return_value = [mock_machine]
        mock_response = AsyncMock()
        mock_response.json.return_value = {"result": "yes", "response": "test"}
        mock_post.return_value = mock_response
        
        response = client.post(
            "/v1/verify",
            json={
                "messages": [{"role": "user", "content": "test message"}],
                "models": ["test-model"],
                "min_yes": 1
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["result"] == "yes"
        assert len(data["results"]) == 1
        assert data["results"][0]["machine"]["network_ip"] == "192.168.1.1"

def test_verify_endpoint_no_models(client: TestClient):
    response = client.post(
        "/v1/verify",
        json={
            "messages": [{"role": "user", "content": "test message"}],
            "models": [],
            "min_yes": 1
        }
    )
    
    assert response.status_code == 400
    assert "At least one model is required" in response.json()["detail"]

def test_verify_endpoint_invalid_min_yes(client: TestClient):
    response = client.post(
        "/v1/verify",
        json={
            "messages": [{"role": "user", "content": "test message"}],
            "models": ["test-model"],
            "min_yes": 0
        }
    )
    
    assert response.status_code == 400
    assert "Minimum yes must be at least 1" in response.json()["detail"]

def test_list_models(client: TestClient):
    # Create a temporary test models file
    test_models = ["model1", "model2", "model3"]
    test_file_path = os.path.join(os.path.dirname(__file__), "test-models.json")
    with open(test_file_path, "w") as f:
        json.dump(test_models, f)
    
    with patch("src.mira_client_dashboard.api.v1.network.os.path.join") as mock_join:
        mock_join.return_value = test_file_path
        
        response = client.get("/v1/models")
        
        assert response.status_code == 200
        data = response.json()
        assert data["object"] == "list"
        assert len(data["data"]) == 3
        assert all(model["object"] == "model" for model in data["data"])
        assert [model["id"] for model in data["data"]] == test_models
    
    # Cleanup
    os.remove(test_file_path)

def test_chat_completions(client: TestClient, session, mock_user, mock_machine, user_credits):
    with patch("src.mira_client_dashboard.api.v1.network.verify_token") as mock_verify, \
         patch("src.mira_client_dashboard.api.v1.network.get_random_machines") as mock_get_machines, \
         patch("src.mira_client_dashboard.api.v1.network.requests.post") as mock_post, \
         patch("src.mira_client_dashboard.core.security.supabase") as mock_supabase:
        
        # Setup mocks
        mock_verify.return_value = mock_user
        mock_get_machines.return_value = [mock_machine]
        mock_response = Mock()
        mock_response.text = "Test response"
        mock_response.status_code = 200
        mock_response.headers = {}
        mock_post.return_value = mock_response
        
        # Setup supabase auth mock
        mock_supabase.auth.get_user.return_value.user = mock_user
        
        response = client.post(
            "/v1/chat/completions",
            json={
                "model": "test-model",
                "messages": [{"role": "user", "content": "test message"}]
            },
            headers={"Authorization": "Bearer test-token"}
        )
        
        assert response.status_code == 200
        assert response.text == "Test response"
        
        # Verify API log was created with ID
        api_log = session.exec(select(ApiLogs)).first()
        assert api_log is not None
        assert api_log.id is not None
        assert api_log.user_id == "test-user-id"
        assert api_log.model == "test-model"
        
        # Verify credits were deducted
        updated_credits = session.exec(
            select(UserCredits).where(UserCredits.user_id == "test-user-id")
        ).first()
        assert updated_credits.credits < 100.0
        
        # Verify credit history was created
        credit_history = session.exec(
            select(UserCreditsHistory).where(UserCreditsHistory.user_id == "test-user-id")
        ).first()
        assert credit_history is not None
        assert credit_history.amount < 0  # Should be negative for deduction

def test_chat_completions_unauthorized(client: TestClient):
    response = client.post(
        "/v1/chat/completions",
        json={
            "model": "test-model",
            "messages": [{"role": "user", "content": "test message"}]
        }
    )
    
    assert response.status_code == 403

def test_chat_completions_insufficient_credits(client: TestClient, session, mock_user, mock_machine):
    # Create user with 0 credits
    credits = UserCredits(
        id=1,
        user_id="test-user-id",
        credits=0.0
    )
    session.add(credits)
    session.commit()

    with patch("src.mira_client_dashboard.api.v1.network.verify_token") as mock_verify, \
         patch("src.mira_client_dashboard.api.v1.network.get_random_machines") as mock_get_machines, \
         patch("src.mira_client_dashboard.core.security.supabase") as mock_supabase:
        
        # Setup mocks
        mock_verify.return_value = mock_user
        mock_get_machines.return_value = [mock_machine]
        
        # Setup supabase auth mock
        mock_supabase.auth.get_user.return_value.user = mock_user
        
        response = client.post(
            "/v1/chat/completions",
            json={
                "model": "test-model",
                "messages": [{"role": "user", "content": "test message"}]
            },
            headers={"Authorization": "Bearer test-token"}
        )
        
        assert response.status_code == 402  # Payment Required