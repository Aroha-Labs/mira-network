import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, Mock, AsyncMock
import os
import httpx
from pathlib import Path

@pytest.fixture
def mock_image_response():
    mock = AsyncMock()
    mock.status_code = 200
    mock.content = b"fake-image-data"
    mock.headers = {"content-type": "image/jpeg"}
    return mock

@pytest.fixture
def cleanup_cache():
    cache_dir = "image_cache"
    os.makedirs(cache_dir, exist_ok=True)
    yield
    for file in Path(cache_dir).glob("*"):
        file.unlink()

def test_proxy_image_success(client: TestClient, mock_image_response, cleanup_cache):
    test_url = "https://example.com/test.jpg"
    
    with patch("src.mira_client_dashboard.api.v1.proxy.httpx.AsyncClient.get") as mock_get:
        mock_get.return_value = mock_image_response
        
        response = client.get(f"/proxy-image?url={test_url}")
        
        assert response.status_code == 200
        assert response.headers["content-type"] == "image/jpeg"
        assert response.content == b"fake-image-data"

def test_proxy_image_fetch_error(client: TestClient, cleanup_cache):
    test_url = "https://example.com/nonexistent.jpg"
    
    with patch("src.mira_client_dashboard.api.v1.proxy.httpx.AsyncClient.get") as mock_get:
        mock_response = AsyncMock()
        mock_response.status_code = 404
        mock_get.return_value = mock_response
        
        response = client.get(f"/proxy-image?url={test_url}")
        
        assert response.status_code == 404
        assert "Failed to fetch image" in response.json()["detail"]

def test_proxy_image_without_url(client: TestClient, cleanup_cache):
    response = client.get("/proxy-image")
    assert response.status_code == 422  # FastAPI validation error

def test_proxy_image_no_content_type(client: TestClient, cleanup_cache):
    test_url = "https://example.com/test.jpg"
    
    with patch("src.mira_client_dashboard.api.v1.proxy.httpx.AsyncClient.get") as mock_get:
        mock_response = AsyncMock()
        mock_response.status_code = 200
        mock_response.content = b"fake-image-data"
        mock_response.headers = {}
        mock_get.return_value = mock_response
        
        response = client.get(f"/proxy-image?url={test_url}")
        
        assert response.status_code == 200
        assert response.content == b"fake-image-data"