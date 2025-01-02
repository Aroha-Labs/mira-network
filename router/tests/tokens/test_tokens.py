import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, Mock
from src.mira_client_dashboard.models import ApiToken
from datetime import datetime, timezone

@pytest.fixture
def mock_user():
    mock = Mock()
    mock.id = "test-user-id"
    return mock

def test_create_api_token(client: TestClient, session, mock_user):
    with patch("src.mira_client_dashboard.main.verify_token") as mock_verify:
        mock_verify.return_value = mock_user
        
        response = client.post(
            "/api-tokens",
            json={"description": "Test Token"},
            headers={"Authorization": "Bearer test-token"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data["description"] == "Test Token"
        assert "created_at" in data
        
        # Verify token was created in DB
        db_token = session.query(ApiToken).first()
        assert db_token is not None
        assert db_token.user_id == "test-user-id"
        assert db_token.description == "Test Token"

def test_list_api_tokens(client: TestClient, session, mock_user):
    # Create some test tokens
    tokens = [
        ApiToken(
            user_id="test-user-id",
            token=f"test-token-{i}",
            description=f"Test Token {i}",
            created_at=datetime.now(timezone.utc)
        ) for i in range(3)
    ]
    for token in tokens:
        session.add(token)
    session.commit()

    with patch("src.mira_client_dashboard.main.verify_token") as mock_verify:
        mock_verify.return_value = mock_user
        
        response = client.get(
            "/api-tokens",
            headers={"Authorization": "Bearer test-token"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 3
        for i, token in enumerate(data):
            assert token["token"] == f"test-token-{i}"
            assert token["description"] == f"Test Token {i}"
            assert "created_at" in token

def test_delete_api_token(client: TestClient, session, mock_user):
    # Create a test token
    token = ApiToken(
        user_id="test-user-id",
        token="test-token-delete",
        description="Token to delete",
        created_at=datetime.now(timezone.utc)
    )
    session.add(token)
    session.commit()

    with patch("src.mira_client_dashboard.main.verify_token") as mock_verify:
        mock_verify.return_value = mock_user
        
        response = client.delete(
            f"/api-tokens/test-token-delete",
            headers={"Authorization": "Bearer test-token"}
        )
        
        assert response.status_code == 200
        assert response.json()["message"] == "Token deleted successfully"
        
        # Verify token was soft deleted
        db_token = session.query(ApiToken).first()
        assert db_token.deleted_at is not None

def test_delete_nonexistent_token(client: TestClient, session, mock_user):
    with patch("src.mira_client_dashboard.main.verify_token") as mock_verify:
        mock_verify.return_value = mock_user
        
        response = client.delete(
            "/api-tokens/nonexistent-token",
            headers={"Authorization": "Bearer test-token"}
        )
        
        assert response.status_code == 404
        assert "Token not found" in response.json()["detail"]
