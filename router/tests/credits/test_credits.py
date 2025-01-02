import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, Mock
from src.mira_client_dashboard.models import UserCredits, UserCreditsHistory

@pytest.fixture
def mock_user():
    mock = Mock()
    mock.id = "test-user-id"
    return mock

def test_add_credit(client: TestClient, session):
    response = client.post(
        "/add-credit",
        json={
            "user_id": "test-user-id",
            "amount": 100.0,
            "description": "Test credit"
        }
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["credits"] == 100.0

def test_get_user_credits(client: TestClient, session, mock_user):
    # Add initial credits
    credits = UserCredits(user_id="test-user-id", credits=50.0)
    session.add(credits)
    session.commit()

    with patch("src.mira_client_dashboard.main.verify_token") as mock_verify:
        mock_verify.return_value = mock_user
        
        response = client.get(
            "/user-credits",
            headers={"Authorization": "Bearer test-token"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["credits"] == 50.0

def test_get_user_credits_history(client: TestClient, session, mock_user):
    # Add some credit history
    history_entries = [
        UserCreditsHistory(
            user_id="test-user-id",
            amount=amount,
            description=f"Test credit {i}"
        ) for i, amount in enumerate([100.0, -20.0, 50.0])
    ]
    for entry in history_entries:
        session.add(entry)
    session.commit()

    with patch("src.mira_client_dashboard.main.verify_token") as mock_verify:
        mock_verify.return_value = mock_user
        
        response = client.get(
            "/user-credits-history",
            headers={"Authorization": "Bearer test-token"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 3
