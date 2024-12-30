from typing import Optional, List, Dict, AsyncGenerator, Union
import httpx
from src.mira_sdk.models import (
    Message,
    ModelProvider,
    AiRequest,
    FlowChatCompletion,
    FlowRequest,
    ApiTokenRequest,
    AddCreditRequest,
)


class MiraClient:
    def __init__(self, base_url: str, api_token: Optional[str] = None):
        """Initialize Mira client.

        Args:
            base_url: Base URL of the Mira API
            api_token: Optional API token for authentication
        """
        self.base_url = base_url
        self.api_token = api_token
        self._client = httpx.AsyncClient()

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self._client.aclose()

    def _get_headers(self) -> Dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.api_token:
            headers["Authorization"] = f"Bearer {self.api_token}"
        return headers

    async def list_models(self) -> List[str]:
        """List available models."""
        response = await self._client.get(
            f"{self.base_url}/v1/models",
            headers=self._get_headers(),
        )
        response.raise_for_status()
        return response.json()

    async def generate(
        self, request: AiRequest
    ) -> Union[str, AsyncGenerator[str, None]]:
        """Generate text using the specified model."""
        response = await self._client.post(
            f"{self.base_url}/v1/chat/completions",
            headers=self._get_headers(),
            json=request.model_dump(),
        )

        response.raise_for_status()

        if request.stream:

            async def stream_response():
                async for chunk in response.aiter_text():
                    yield chunk

            return stream_response()
        else:
            return response.json()

    async def generate_with_flow(
        self, flow_id: str, request: FlowChatCompletion
    ) -> Union[str, AsyncGenerator[str, None]]:
        """Generate text using a specific flow."""
        response = await self._client.post(
            f"{self.base_url}/v1/flows/{flow_id}/chat/completions",
            headers=self._get_headers(),
            json=request.model_dump(),
        )
        response.raise_for_status()
        return response.json()

    async def list_flows(self) -> List[Dict]:
        """List all flows."""
        response = await self._client.get(
            f"{self.base_url}/flows",
            headers=self._get_headers(),
        )
        response.raise_for_status()
        return response.json()

    async def get_flow(self, flow_id: str) -> Dict:
        """Get details of a specific flow."""
        response = await self._client.get(
            f"{self.base_url}/flows/{flow_id}",
            headers=self._get_headers(),
        )
        response.raise_for_status()
        return response.json()

    async def create_flow(self, request: FlowRequest) -> Dict:
        """Create a new flow."""
        response = await self._client.post(
            f"{self.base_url}/flows",
            headers=self._get_headers(),
            json=request.model_dump(),
        )
        response.raise_for_status()
        return response.json()

    async def update_flow(self, flow_id: str, request: FlowRequest) -> Dict:
        """Update an existing flow."""
        response = await self._client.put(
            f"{self.base_url}/flows/{flow_id}",
            headers=self._get_headers(),
            json=request.model_dump(),
        )
        response.raise_for_status()
        return response.json()

    async def delete_flow(self, flow_id: str) -> None:
        """Delete a flow."""
        response = await self._client.delete(
            f"{self.base_url}/flows/{flow_id}",
            headers=self._get_headers(),
        )
        response.raise_for_status()

    async def create_api_token(self, request: ApiTokenRequest) -> Dict:
        """Create a new API token."""
        response = await self._client.post(
            f"{self.base_url}/tokens",
            headers=self._get_headers(),
            json=request.model_dump(),
        )
        response.raise_for_status()
        return response.json()

    async def list_api_tokens(self) -> List[Dict]:
        """List all API tokens."""
        response = await self._client.get(
            f"{self.base_url}/tokens",
            headers=self._get_headers(),
        )
        response.raise_for_status()
        return response.json()

    async def delete_api_token(self, token: str) -> None:
        """Delete an API token."""
        response = await self._client.delete(
            f"{self.base_url}/tokens/{token}",
            headers=self._get_headers(),
        )
        response.raise_for_status()

    async def get_user_credits(self) -> Dict:
        """Get user credits information."""
        response = await self._client.get(
            f"{self.base_url}/credits",
            headers=self._get_headers(),
        )
        response.raise_for_status()
        return response.json()

    async def add_credit(self, request: AddCreditRequest) -> Dict:
        """Add credits to a user account."""
        response = await self._client.post(
            f"{self.base_url}/credits",
            headers=self._get_headers(),
            json=request.model_dump(),
        )
        response.raise_for_status()
        return response.json()

    async def get_credits_history(self) -> List[Dict]:
        """Get user credits history."""
        response = await self._client.get(
            f"{self.base_url}/credits/history",
            headers=self._get_headers(),
        )
        response.raise_for_status()
        return response.json()
