import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, Mock
from src.mira_client_dashboard.models import ApiLogs
from datetime import datetime, timezone

@pytest.fixture
def mock_user():
    mock = Mock()
    mock.id = "test-user-id"
    return mock

@pytest.fixture
def sample_logs(session):
    logs = [
        ApiLogs(
            user_id="test-user-id",
            payload='{"model": "test-model", "messages": [{"role": "user", "content": "test"}]}',
            response="Test response",
            prompt_tokens=10,
            completion_tokens=20,
            total_tokens=30,
            total_response_time=1.5,
            model="test-model",
            created_at=datetime.now(timezone.utc)
        ) for _ in range(3)
    ]
    for log in logs:
        session.add(log)
    session.commit()
    return logs

def test_get_api_logs(client: TestClient, session, mock_user, sample_logs):
    with patch("src.mira_client_dashboard.main.verify_token") as mock_verify:
        mock_verify.return_value = mock_user
        
        response = client.get(
            "/api-logs",
            headers={"Authorization": "Bearer test-token"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "logs" in data
        assert len(data["logs"]) == 3
        assert data["total"] == 3
        assert data["page"] == 1
        assert data["page_size"] == 10

def test_get_api_logs_with_filters(client: TestClient, session, mock_user, sample_logs):
    with patch("src.mira_client_dashboard.main.verify_token") as mock_verify:
        mock_verify.return_value = mock_user
        
        response = client.get(
            "/api-logs?page=1&page_size=2&order_by=total_tokens&order=desc",
            headers={"Authorization": "Bearer test-token"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["logs"]) == 2
        assert data["total"] == 3
        assert data["page_size"] == 2

def test_total_inference_calls(client: TestClient, session, mock_user, sample_logs):
    with patch("src.mira_client_dashboard.main.verify_token") as mock_verify:
        mock_verify.return_value = mock_user
        
        response = client.get(
            "/total-inference-calls",
            headers={"Authorization": "Bearer test-token"}
        )
        
        assert response.status_code == 200
        assert response.json() == 3
