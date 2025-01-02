import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, mock_open

def test_list_models(client: TestClient):
    # Mock the supported-models.json file content
    # Note: This is now a string, not a list
    mock_models = '["model1", "model2", "model3"]'
    
    with patch("builtins.open", mock_open(read_data=mock_models)):
        response = client.get("/v1/models")
        assert response.status_code == 200
        data = response.json()
        
        assert data["object"] == "list"
        assert len(data["data"]) == 3
        assert data["data"][0]["id"] == "model1"
        assert data["data"][0]["object"] == "model"
