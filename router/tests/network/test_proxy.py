import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, Mock, mock_open
import os
from urllib.parse import urlencode
from hashlib import md5

@pytest.fixture
def mock_image_data():
    return b"fake-image-data"

@pytest.fixture(autouse=True)
def setup_image_cache():
    """Create image_cache directory for tests"""
    os.makedirs("image_cache", exist_ok=True)
    yield
    # Cleanup after tests
    for file in os.listdir("image_cache"):
        os.remove(os.path.join("image_cache", file))
    os.rmdir("image_cache")

@pytest.mark.asyncio
async def test_proxy_image_cached(client: TestClient, mock_image_data):
    test_file = "image_cache/test_image.jpg"
    
    # Create a test file
    with open(test_file, "wb") as f:
        f.write(mock_image_data)
    
    params = {"url": "https://example.com/image.jpg"}
    url = f"/proxy-image?{urlencode(params)}"
    
    # Mock both md5 and httpx.AsyncClient
    with patch("hashlib.md5") as mock_md5, \
         patch("httpx.AsyncClient") as mock_client:
        
        # Setup md5 mock
        mock_md5().hexdigest.return_value = "test_image"
        
        # Setup httpx mock
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.content = mock_image_data
        mock_response.headers = {"content-type": "image/jpeg"}
        
        mock_client.return_value.__aenter__.return_value.get.return_value = mock_response
        
        response = client.get(url)
        assert response.status_code == 200

@pytest.mark.asyncio
async def test_proxy_image_download(client: TestClient, mock_image_data):
    params = {"url": "https://example.com/image.jpg"}
    url = f"/proxy-image?{urlencode(params)}"
    
    with patch("hashlib.md5") as mock_md5, \
         patch("httpx.AsyncClient") as mock_client:
        
        # Setup md5 mock
        mock_md5().hexdigest.return_value = "test_download"
        
        # Setup httpx mock
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.content = mock_image_data
        mock_response.headers = {"content-type": "image/jpeg"}
        
        mock_client.return_value.__aenter__.return_value.get.return_value = mock_response
        
        response = client.get(url)
        assert response.status_code == 200

@pytest.mark.asyncio
async def test_proxy_image_download_failure(client: TestClient):
    params = {"url": "https://example.com/not-found.jpg"}
    url = f"/proxy-image?{urlencode(params)}"
    
    with patch("httpx.AsyncClient") as mock_client:
        # Setup httpx mock for failure
        mock_response = Mock()
        mock_response.status_code = 404
        
        mock_client.return_value.__aenter__.return_value.get.return_value = mock_response
        
        response = client.get(url)
        assert response.status_code == 404
