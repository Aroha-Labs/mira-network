from fastapi import HTTPException
from fastapi.responses import StreamingResponse, Response
import requests
import json
from typing import List, Tuple

from ..models.chat import Message, ModelProvider, Tool
from ..core.config import MODEL_PROVIDERS


def get_model_provider(
    model: str,
    model_provider: ModelProvider | None,
) -> tuple[ModelProvider, str]:
    if model == "":
        raise HTTPException(status_code=400, detail="Model is required")

    if model_provider is not None:
        return model_provider, model

    provider_name, model_name = model.split("/", 1)

    if not model_name or model_name == "":
        raise HTTPException(status_code=400, detail="Invalid model name")

    if provider_name not in MODEL_PROVIDERS:
        raise HTTPException(status_code=400, detail="Invalid model provider")

    return MODEL_PROVIDERS[provider_name], model_name


def get_llm_completion(
    model: str,
    model_provider: ModelProvider,
    messages: list[Message],
    stream: bool = False,
    tools: list[Tool] = None,
    tool_choice: str = "auto",
):
    """
    Get completion from LLM with support for function/tool calling across different providers
    """
    payload = {
        "model": model,
        "messages": [msg.model_dump() for msg in messages],
        "stream": stream,
    }

    # Add tools/functions if provided
    if tools:
        if model_provider.provider_name == "anthropic":
            payload["tools"] = [tool.model_dump() for tool in tools]
        else:
            payload["tools"] = [tool.model_dump() for tool in tools]
            if tool_choice != "auto":
                payload["tool_choice"] = tool_choice

    try:
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {model_provider.api_key}",
            "Accept-Encoding": "identity",
        }

        req = requests.post(
            url=f"{model_provider.base_url}/chat/completions",
            headers=headers,
            json=payload,
            stream=stream,
        )
        req.raise_for_status()

        if stream:
            return StreamingResponse(
                req.iter_content(chunk_size=1024),
                media_type="text/event-stream",
            )

        # Convert provider-specific response to OpenAI format if needed
        response_data = req.json()
        if model_provider.provider_name == "anthropic":
            if "tool_calls" in response_data.get("content", []):
                response_data["choices"][0]["message"]["function_call"] = {
                    "name": response_data["content"][0]["tool_calls"][0]["function"]["name"],
                    "arguments": response_data["content"][0]["tool_calls"][0]["function"]["arguments"],
                }

        return Response(
            content=json.dumps(response_data),
            status_code=req.status_code,
            headers=dict(req.headers),
        )

    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Error calling LLM API: {str(e)}") 