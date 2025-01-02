import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, Mock
from src.mira_client_dashboard.models import Flows
from src.mira_client_dashboard.main import FlowRequest, FlowChatCompletion

@pytest.fixture
def mock_user():
    mock = Mock()
    mock.id = "test-user-id"
    return mock

@pytest.fixture
def sample_flow(session):
    flow = Flows(
        user_id="test-user-id",
        name="test-flow",
        system_prompt="You are a helpful assistant",
    )
    session.add(flow)
    session.commit()
    return flow

def test_create_flow(client: TestClient, session):
    response = client.post(
        "/flows",
        json={
            "name": "test-flow",
            "system_prompt": "You are a helpful assistant"
        }
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "test-flow"
    assert data["system_prompt"] == "You are a helpful assistant"

def test_get_flow(client: TestClient, session, sample_flow):
    response = client.get(f"/flows/{sample_flow.id}")
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "test-flow"
    assert data["system_prompt"] == "You are a helpful assistant"

def test_get_nonexistent_flow(client: TestClient, session):
    response = client.get("/flows/nonexistent-id")
    assert response.status_code == 404
    assert response.json()["detail"] == "Flow not found"

def test_list_flows(client: TestClient, session):
    # Create multiple flows
    flows = [
        Flows(
            name=f"test-flow-{i}",
            system_prompt="You are a helpful assistant",
        ) for i in range(3)
    ]
    for flow in flows:
        session.add(flow)
    session.commit()

    response = client.get("/flows")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 3

def test_update_flow(client: TestClient, session, sample_flow):
    response = client.put(
        f"/flows/{sample_flow.id}",
        json={
            "name": "updated-flow",
            "system_prompt": "Updated prompt"
        }
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "updated-flow"
    assert data["system_prompt"] == "Updated prompt"

def test_delete_flow(client: TestClient, session, sample_flow):
    response = client.delete(f"/flows/{sample_flow.id}")
    assert response.status_code == 200
    assert response.json()["message"] == "Flow deleted successfully"

    # Verify flow was deleted
    flow = session.query(Flows).filter(Flows.id == sample_flow.id).first()
    assert flow is None

def test_chat_with_flow(client: TestClient, session, sample_flow):
    with patch("src.mira_client_dashboard.main.get_random_machines") as mock_get_machines, \
         patch("requests.post") as mock_post:
        
        # Setup machine mock
        mock_machine = Mock()
        mock_machine.network_ip = "192.168.1.1"
        mock_get_machines.return_value = [mock_machine]
        
        # Setup response mock
        mock_response = Mock()
        mock_response.text = '{"choices":[{"message":{"content":"Test response"}}]}'
        mock_response.status_code = 200
        mock_response.headers = {}
        mock_post.return_value = mock_response
        
        response = client.post(
            f"/v1/flow/{sample_flow.id}/chat/completions",
            json={
                "messages": [{"role": "user", "content": "Hello"}],
                "variables": {"key": "value"}
            }
        )
        
        assert response.status_code == 200

def test_chat_with_flow_missing_variables(client: TestClient, session):
    # Create a flow with variables in system prompt
    flow = Flows(
        name="test-flow",
        system_prompt="Hello {name}, how are you?"
    )
    session.add(flow)
    session.commit()

    response = client.post(
        f"/v1/flow/{flow.id}/chat/completions",
        json={
            "messages": [{"role": "user", "content": "Hello"}]
            # Missing variables
        }
    )
    
    assert response.status_code == 400  # or whatever your error code is

def test_chat_with_flow_with_system_message(client: TestClient, session, sample_flow):
    response = client.post(
        f"/v1/flow/{sample_flow.id}/chat/completions",
        json={
            "messages": [
                {"role": "system", "content": "You are a bot"},  # Should not be allowed
                {"role": "user", "content": "Hello"}
            ]
        }
    )
    
    assert response.status_code == 400
    assert "System message is not allowed" in response.json()["detail"]
