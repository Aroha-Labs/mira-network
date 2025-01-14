from typing import AsyncIterator, Optional, List, Dict, AsyncGenerator, Union, Any
import httpx
from .models import (
    AiRequest,
    ApiTokenRequest,
    Message,
)


class MiraClient:
    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: str = "https://apis.mira.network",
    ):
        """Initialize Mira client.

        Args:
            api_key: API key for authentication
            base_url: Base URL of the Mira API
        """
        self.base_url = base_url
        self.api_key = api_key
        self._client = httpx.AsyncClient()

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self._client.aclose()

    def _get_headers(self) -> Dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers

    async def chat_completions_create(
        self,
        model: str,
        messages: list[Message],
        stream: bool = False,
        **kwargs: Any,
    ) -> Union[Dict[str, Any], AsyncIterator[Dict[str, Any]]]:
        """Create a chat completion.

        Args:
            model: The model to use for completion
            messages: A list of messages in the conversation
            stream: Whether to stream the response
            **kwargs: Additional parameters to pass to the API
        """
        request = AiRequest(
            model=model,
            messages=messages,
            stream=stream,
            **kwargs,
        )

        response = await self._client.post(
            f"{self.base_url}/v1/chat/completions",
            headers=self._get_headers(),
            json=request.model_dump(),
        )
        response.raise_for_status()

        if stream:
            return self._stream_response(response)
        return response.json()

    async def _stream_response(
        self, response: httpx.Response
    ) -> AsyncIterator[Dict[str, Any]]:
        """Handle streaming response.

        Args:
            response: The HTTP response object
        """
        async for line in response.aiter_lines():
            if line.strip():
                yield self._format_stream_response(line)

    def _format_stream_response(self, line: str) -> Dict[str, Any]:
        """Format streaming response to match OpenAI's format.

        Args:
            line: The response line
        """
        # Add formatting logic here if needed
        return {"choices": [{"delta": {"content": line}}]}

    async def list_models(self) -> List[str]:
        """List available models."""
        response = await self._client.get(
            f"{self.base_url}/v1/models",
            headers=self._get_headers(),
        )
        response.raise_for_status()
        return response.json()

    async def create_api_token(self, request: ApiTokenRequest) -> Dict:
        """Create a new API token."""
        response = await self._client.post(
            f"{self.base_url}/api-tokens",
            headers=self._get_headers(),
            json=request.model_dump(),
        )
        response.raise_for_status()
        return response.json()

    async def list_api_tokens(self) -> List[Dict]:
        """List all API tokens."""
        response = await self._client.get(
            f"{self.base_url}/api-tokens",
            headers=self._get_headers(),
        )
        response.raise_for_status()
        return response.json()

    async def delete_api_token(self, token: str) -> None:
        """Delete an API token."""
        response = await self._client.delete(
            f"{self.base_url}/api-tokens/{token}",
            headers=self._get_headers(),
        )
        response.raise_for_status()

    async def get_user_credits(self) -> Dict:
        """Get user credits information."""
        response = await self._client.get(
            f"{self.base_url}/user-credits",
            headers=self._get_headers(),
        )
        response.raise_for_status()
        return response.json()

    async def get_credits_history(self) -> List[Dict]:
        """Get user credits history."""
        response = await self._client.get(
            f"{self.base_url}/user-credits-history",
            headers=self._get_headers(),
        )
        response.raise_for_status()
        return response.json()
