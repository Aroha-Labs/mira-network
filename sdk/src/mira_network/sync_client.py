from typing import Optional, List, Dict, Iterator, Union
import requests
from .models import (
    AiRequest,
    ApiTokenRequest,
)


class MiraSyncClient:
    def __init__(
        self,
        base_url: str = "https://apis.mira.network",
        api_token: Optional[str] = None,
    ):
        """Initialize Mira synchronous client.

        Args:
            base_url: Base URL of the Mira API
            api_token: Optional API token for authentication
        """
        self.base_url = base_url
        self.api_token = api_token
        self._session = requests.Session()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self._session.close()

    def _get_headers(self) -> Dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.api_token:
            headers["Authorization"] = f"Bearer {self.api_token}"
        return headers

    def list_models(self) -> List[str]:
        """List available models."""
        response = self._session.get(
            f"{self.base_url}/v1/models",
            headers=self._get_headers(),
        )
        response.raise_for_status()
        return response.json()

    def generate(self, request: AiRequest) -> Union[str, Iterator[str]]:
        """Generate text using the specified model.

        Args:
            request: The AI request configuration

        Returns:
            Either a string response (when stream=False) or an iterator of string chunks (when stream=True)
        """
        response = self._session.post(
            f"{self.base_url}/v1/chat/completions",
            headers=self._get_headers(),
            json=request.model_dump(),
            stream=request.stream,
        )
        response.raise_for_status()

        if request.stream:
            return response.iter_lines(decode_unicode=True)
        else:
            return response.json()

    def create_api_token(self, request: ApiTokenRequest) -> Dict:
        """Create a new API token."""
        response = self._session.post(
            f"{self.base_url}/api-tokens",
            headers=self._get_headers(),
            json=request.model_dump(),
        )
        response.raise_for_status()
        return response.json()

    def list_api_tokens(self) -> List[Dict]:
        """List all API tokens."""
        response = self._session.get(
            f"{self.base_url}/api-tokens",
            headers=self._get_headers(),
        )
        response.raise_for_status()
        return response.json()

    def delete_api_token(self, token: str) -> None:
        """Delete an API token."""
        response = self._session.delete(
            f"{self.base_url}/api-tokens/{token}",
            headers=self._get_headers(),
        )
        response.raise_for_status()

    def get_user_credits(self) -> Dict:
        """Get user credits information."""
        response = self._session.get(
            f"{self.base_url}/user-credits",
            headers=self._get_headers(),
        )
        response.raise_for_status()
        return response.json()

    def get_credits_history(self) -> List[Dict]:
        """Get user credits history."""
        response = self._session.get(
            f"{self.base_url}/user-credits-history",
            headers=self._get_headers(),
        )
        response.raise_for_status()
        return response.json()
