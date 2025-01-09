import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, Mock
from src.mira_client_dashboard.models import Machine
from sqlmodel import select
from datetime import datetime, timezone

@pytest.fixture
def mock_redis():
    with patch("src.mira_client_dashboard.api.v1.machines.redis_client") as mock:
        yield mock

@pytest.fixture
def sample_machine(session):
    machine = Machine(
        id=1,
        network_machine_uid="test-machine",
        network_ip="192.168.1.1"
    )
    session.add(machine)
    session.commit()
    return machine

def test_register_machine(client: TestClient, session):
    response = client.post(
        "/register/test-machine",
        json={"network_ip": "192.168.1.1"}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["machine_uid"] == "test-machine"
    assert data["network_ip"] == "192.168.1.1"
    assert data["status"] == "registered"
    
    # Verify machine was created in DB
    machine = session.exec(
        select(Machine).where(Machine.network_machine_uid == "test-machine")
    ).first()
    assert machine is not None
    assert machine.network_ip == "192.168.1.1"

def test_register_duplicate_machine(client: TestClient, session, sample_machine):
    response = client.post(
        "/register/test-machine",
        json={"network_ip": "192.168.1.2"}
    )
    
    assert response.status_code == 400
    assert "Machine already registered" in response.json()["detail"]

def test_check_liveness_online(client: TestClient, session, sample_machine, mock_redis):
    # Mock redis to return online status
    mock_redis.get.return_value = "online"
    
    response = client.get(f"/liveness/{sample_machine.network_machine_uid}")
    
    assert response.status_code == 200
    data = response.json()
    assert data["machine_uid"] == sample_machine.network_machine_uid
    assert data["status"] == "online"

def test_check_liveness_offline(client: TestClient, session, sample_machine, mock_redis):
    # Mock redis to return None (offline status)
    mock_redis.get.return_value = None
    
    response = client.get(f"/liveness/{sample_machine.network_machine_uid}")
    
    assert response.status_code == 200
    data = response.json()
    assert data["machine_uid"] == sample_machine.network_machine_uid
    assert data["status"] == "offline"

def test_check_liveness_nonexistent_machine(client: TestClient, session):
    response = client.get("/liveness/nonexistent-machine")
    assert response.status_code == 404
    assert "Machine not found" in response.json()["detail"]

def test_set_liveness(client: TestClient, session, sample_machine, mock_redis):
    mock_redis.get.side_effect = [
        "1234567890",  # For liveness-start
        None,          # For network_ip
    ]
    
    response = client.post(f"/liveness/{sample_machine.network_machine_uid}")
    
    assert response.status_code == 200
    data = response.json()
    assert data["machine_uid"] == sample_machine.network_machine_uid
    assert data["status"] == "online"
    
    # Verify redis calls
    mock_redis.setnx.assert_called_once()
    mock_redis.expire.assert_called()
    mock_redis.hset.assert_called_once()

def test_list_machines(client: TestClient, session, sample_machine):
    with patch("src.mira_client_dashboard.api.v1.machines.get_online_machines") as mock_get_online:
        mock_get_online.return_value = ["test-machine"]
        
        response = client.get("/machines")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["machine_uid"] == "test-machine"
        assert data[0]["network_ip"] == "192.168.1.1"
        assert data[0]["status"] == "online"

def test_list_online_machines(client: TestClient, mock_redis):
    with patch("src.mira_client_dashboard.api.v1.machines.get_online_machines") as mock_get_online:
        mock_get_online.return_value = ["machine1", "machine2"]
        
        response = client.get("/machines/online")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        assert data[0]["machine_uid"] == "machine1"
        assert data[1]["machine_uid"] == "machine2"