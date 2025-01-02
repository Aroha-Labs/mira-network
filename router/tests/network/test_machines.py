import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch

@pytest.fixture
def mock_online_machines():
    return ["machine1", "machine2"]

def test_register_machine(client: TestClient, session):
    machine_data = {
        "network_ip": "192.168.1.1"
    }
    response = client.post("/register/test-machine", json=machine_data)
    assert response.status_code == 200
    assert response.json() == {
        "machine_uid": "test-machine",
        "network_ip": "192.168.1.1",
        "status": "registered"
    }

def test_register_duplicate_machine(client: TestClient, session):
    machine_data = {
        "network_ip": "192.168.1.1"
    }
    # Register first time
    client.post("/register/test-machine", json=machine_data)
    # Try to register same machine again
    response = client.post("/register/test-machine", json=machine_data)
    assert response.status_code == 400
    assert "Machine already registered" in response.json()["detail"]

@patch("src.mira_client_dashboard.main.get_online_machines")
def test_list_machines(mock_get_online, client: TestClient, session):
    # Register a test machine first
    machine_data = {"network_ip": "192.168.1.1"}
    client.post("/register/test-machine", json=machine_data)
    
    # Mock online machines
    mock_get_online.return_value = ["test-machine"]
    
    response = client.get("/machines")
    assert response.status_code == 200
    machines = response.json()
    assert len(machines) == 1
    assert machines[0]["machine_uid"] == "test-machine"
    assert machines[0]["network_ip"] == "192.168.1.1"
    assert machines[0]["status"] == "online"

@patch("src.mira_client_dashboard.main.get_online_machines")
def test_list_online_machines(mock_get_online, client: TestClient):
    mock_get_online.return_value = ["machine1", "machine2"]
    response = client.get("/machines/online")
    assert response.status_code == 200
    machines = response.json()
    assert len(machines) == 2
    assert machines[0]["machine_uid"] == "machine1"
    assert machines[1]["machine_uid"] == "machine2"
