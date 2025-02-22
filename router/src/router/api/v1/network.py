from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, Response, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlmodel import Session, select, update
from src.router.core.settings_types import SETTINGS_MODELS
from src.router.core.types import ModelPricing, User
from src.router.models.logs import ApiLogs
from src.router.db.session import get_session, get_async_session
from src.router.core.security import async_verify_user
from src.router.utils.network import (
    get_random_machines,
    PROXY_PORT,
)
from src.router.models.user import User as UserModel, UserCreditsHistory
from src.router.schemas.ai import AiRequest, VerifyRequest
import requests
import time
import httpx
import json
from src.router.utils.settings import get_setting_value
from src.router.utils.settings import get_supported_models
import asyncio
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()


@router.post(
    "/v1/verify",
    summary="Verify Model Response",
    description="""Verifies responses from multiple AI models against a given prompt.

### Authentication
- No authentication required
- Rate limiting may apply

### Request Body
```json
{
    "messages": [
        {
            "role": "user" | "assistant" | "system",
            "content": string
        }
    ],
    "models": string[],  // List of model identifiers to verify with
    "min_yes": int      // Minimum number of 'yes' responses required
}
```

### Response Format
```json
{
    "result": "yes" | "no",
    "results": [
        {
            "machine": {
                "machine_uid": string,
                "network_ip": string
            },
            "result": "yes" | "no",
            "response": {
                // Raw response from the model
                "result": "yes" | "no",
                // Additional model-specific response data
            }
        }
    ]
}
```

### Error Responses
- `400 Bad Request`:
    ```json
    {
        "detail": "At least one model is required"
    }
    ```
    ```json
    {
        "detail": "Minimum yes must be at least 1"
    }
    ```
    ```json
    {
        "detail": "Minimum yes must be less than or equal to the number of models"
    }
    ```

### Notes
- Distributes verification requests across available machines
- Returns aggregated results from all models
- Overall result is 'yes' if at least min_yes models return 'yes'
- Each model's individual response is included in the results array""",
    response_description="Returns verification results from all models",
    responses={
        200: {
            "description": "Successfully verified responses",
            "content": {
                "application/json": {
                    "example": {
                        "result": "yes",
                        "results": [
                            {
                                "machine": {
                                    "machine_uid": "machine_123",
                                    "network_ip": "10.0.0.1",
                                },
                                "result": "yes",
                                "response": {"result": "yes", "confidence": 0.95},
                            },
                            {
                                "machine": {
                                    "machine_uid": "machine_456",
                                    "network_ip": "10.0.0.2",
                                },
                                "result": "no",
                                "response": {"result": "no", "confidence": 0.75},
                            },
                        ],
                    }
                }
            },
        },
        400: {
            "description": "Invalid request parameters",
            "content": {
                "application/json": {
                    "examples": {
                        "no_models": {
                            "value": {"detail": "At least one model is required"}
                        },
                        "invalid_min_yes": {
                            "value": {"detail": "Minimum yes must be at least 1"}
                        },
                        "min_yes_too_high": {
                            "value": {
                                "detail": "Minimum yes must be less than or equal to the number of models"
                            }
                        },
                    }
                }
            },
        },
    },
)
async def verify(req: VerifyRequest, db: Session = Depends(get_session)):
    if len(req.models) < 1:
        raise HTTPException(status_code=400, detail="At least one model is required")

    if req.min_yes < 1:
        raise HTTPException(status_code=400, detail="Minimum yes must be at least 1")

    if req.min_yes > len(req.models):
        raise HTTPException(
            status_code=400,
            detail="Minimum yes must be less than or equal to the number of models",
        )

    supported_models = get_supported_models(db)

    # Validate and transform all models
    transformed_models = []
    for model in req.models:
        if model not in supported_models:
            raise HTTPException(status_code=400, detail=f"Unsupported model: {model}")
        model_config = supported_models[model]
        transformed_models.append({"original": model, "id": model_config.id})

    async def process_model(model, idx):
        machine = get_random_machines(1)
        proxy_url = f"http://{machine[0].network_ip}:{PROXY_PORT}/v1/verify"
        async with httpx.AsyncClient(timeout=httpx.Timeout(60.0)) as client:
            response = await client.post(
                proxy_url,
                json={
                    "messages": [
                        {"role": msg.role, "content": msg.content}
                        for msg in req.messages
                    ],
                    "model": model["id"],
                },
            )
            response_data = response.json()
            return {
                "machine": machine,
                "result": response_data["result"],
                "response": response_data,
                "model": transformed_models[idx]["original"],
            }

    # Make parallel requests
    results = await asyncio.gather(
        *[process_model(model, idx) for idx, model in enumerate(transformed_models)]
    )

    yes_count = sum(1 for result in results if result["result"] == "yes")
    if yes_count >= req.min_yes:
        return {"result": "yes", "results": results}
    else:
        return {"result": "no", "results": results}


class ModelListResItem(BaseModel):
    id: str
    object: str


class ModelListRes(BaseModel):
    object: str
    data: list[ModelListResItem]


@router.get(
    "/v1/models",
    summary="List Available Models",
    description="""Retrieves a list of all supported language models in the system.

### Authentication
- No authentication required
- Rate limiting may apply

### Response Format
```json
{
    "object": "list",
    "data": [
        {
            "id": string,     // Model identifier
            "object": "model" // Always "model"
        }
    ]
}
```

### Example Models
- `openrouter/meta-llama/llama-3.3-70b-instruct`
- `openai/gpt-4`
- `openrouter/anthropic/claude-3.5-sonnet`

### Notes
- Models are fetched from system settings
- Availability may vary based on system configuration
- Model list is cached and periodically updated
- Returns all models regardless of user access level""",
    response_description="Returns an array of available model information",
    responses={
        200: {
            "description": "Successfully retrieved models list",
            "content": {
                "application/json": {
                    "example": {
                        "object": "list",
                        "data": [
                            {
                                "id": "openrouter/meta-llama/llama-3.3-70b-instruct",
                                "object": "model",
                            },
                            {"id": "openai/gpt-4", "object": "model"},
                            {
                                "id": "openrouter/anthropic/claude-3.5-sonnet",
                                "object": "model",
                            },
                        ],
                    }
                }
            },
        }
    },
)
async def list_models(db: Session = Depends(get_session)) -> ModelListRes:
    supported_models = get_supported_models(db)
    return {
        "object": "list",
        "data": [
            {"id": model_id, "object": "model"}
            for model_id, _ in supported_models.items()
        ],
    }


async def save_log(
    db: AsyncSession,
    user: User,
    user_row: UserModel,
    req: AiRequest,
    original_req_model: str,
    result_text: str,
    usage: dict,
    ttfs: Optional[float],
    timeStart: float,
    machine_id: int,
    flow_id: Optional[str] = None,
) -> None:
    sm = await get_setting_value(
        db,
        "SUPPORTED_MODELS",
        SETTINGS_MODELS["SUPPORTED_MODELS"],
    )

    model_p = sm.root.get(original_req_model)

    if model_p is None:
        raise HTTPException(
            status_code=500, detail="Supported model not found in settings"
        )

    model_pricing = ModelPricing(
        model=req.model,
        prompt_token=model_p.prompt_token,
        completion_token=model_p.completion_token,
    )

    req.model = original_req_model

    # Log the request
    api_log = ApiLogs(
        user_id=user.id,
        api_key_id=user.api_key_id,
        payload=req.model_dump_json(),
        request_payload=req.model_dump(),
        ttft=ttfs,
        response=result_text,
        prompt_tokens=usage.get("prompt_tokens", 0),
        completion_tokens=usage.get("completion_tokens", 0),
        total_tokens=usage.get("total_tokens", 0),
        total_response_time=time.time() - timeStart,
        model=req.model,
        model_pricing=model_pricing,
        machine_id=str(machine_id),
        flow_id=flow_id,
    )

    db.add(api_log)

    # Calculate cost and reduce user credits
    prompt_tokens = usage.get("prompt_tokens", 0)
    completion_tokens = usage.get("completion_tokens", 0)
    total_tokens = usage.get("total_tokens", 0)

    prompt_tokens_cost = prompt_tokens * model_p.prompt_token
    completion_tokens_cost = completion_tokens * model_p.completion_token

    cost = prompt_tokens_cost + completion_tokens_cost

    await db.execute(
        update(UserModel)
        .where(UserModel.user_id == user.id)
        .values(
            credits=user_row.credits - cost,
            updated_at=datetime.now(timezone.utc),
        )
    )

    # Update user credit history
    user_credits_history = UserCreditsHistory(
        user_id=user.id,
        amount=-cost,
        description=f"Used {total_tokens} tokens. Prompt tokens: {prompt_tokens}, Completion tokens: {completion_tokens}",
        created_at=datetime.now(timezone.utc),
    )
    db.add(user_credits_history)
    await db.commit()


@router.post(
    "/v1/chat/completions",
    summary="Generate Chat Completion",
    description="""Generates a chat completion using the specified model.

### Authentication
- Requires a valid authentication token
- Token must be passed in the Authorization header
- Sufficient credits required for generation

### Request Body
```json
{
    "model": string,
    "model_provider": {
        "base_url": string,
        "api_key": string
    } | null,
    "messages": [
        {
            "role": "system" | "user" | "assistant",
            "content": string
        }
    ],
    "stream": boolean,
    "tools": [
        {
            "type": "function",
            "function": {
                "name": string,
                "description": string,
                "parameters": object
            }
        }
    ] | null,
    "tool_choice": string
}
```

### Response Format (Non-Streaming)
```json
{
    "id": string,
    "object": "chat.completion",
    "created": int,
    "model": string,
    "choices": [
        {
            "index": 0,
            "message": {
                "role": "assistant",
                "content": string,
                "tool_calls": [
                    {
                        "id": string,
                        "type": "function",
                        "function": {
                            "name": string,
                            "arguments": string
                        }
                    }
                ] | null
            },
            "finish_reason": "stop" | "length" | "tool_calls"
        }
    ],
    "usage": {
        "prompt_tokens": int,
        "completion_tokens": int,
        "total_tokens": int
    }
}
```

### Streaming Response Format
Server-sent events with the following data structure:
```json
{
    "content": string | null,
    "tool_calls": [
        {
            "id": string,
            "type": "function",
            "function": {
                "name": string,
                "arguments": string
            },
            "index": int
        }
    ] | null
}
```

### Error Responses
- `400 Bad Request`:
    ```json
    {
        "detail": "Unsupported model"
    }
    ```
- `401 Unauthorized`:
    ```json
    {
        "detail": "Could not validate credentials"
    }
    ```
- `402 Payment Required`:
    ```json
    {
        "detail": "Insufficient credits"
    }
    ```
- `404 Not Found`:
    ```json
    {
        "detail": "User not found"
    }
    ```

### Notes
- Supports both streaming and non-streaming responses
- Automatically tracks usage and deducts credits
- Records performance metrics (TTFT, total response time)
- Distributes requests across available machines
- Supports function calling through tools parameter
- Credits are calculated based on prompt and completion tokens
- Response streaming uses server-sent events (SSE)""",
    response_description="Returns the model's completion response",
    responses={
        200: {
            "description": "Successfully generated completion",
            "content": {
                "application/json": {
                    "example": {
                        "id": "chatcmpl-123",
                        "object": "chat.completion",
                        "created": 1677858242,
                        "model": "gpt-4",
                        "choices": [
                            {
                                "index": 0,
                                "message": {
                                    "role": "assistant",
                                    "content": "Hello! How can I help you today?",
                                    "tool_calls": None,
                                },
                                "finish_reason": "stop",
                            }
                        ],
                        "usage": {
                            "prompt_tokens": 10,
                            "completion_tokens": 8,
                            "total_tokens": 18,
                        },
                    }
                }
            },
        },
        400: {
            "description": "Invalid request or unsupported model",
            "content": {
                "application/json": {"example": {"detail": "Unsupported model"}}
            },
        },
        401: {
            "description": "Unauthorized - Invalid or missing authentication",
            "content": {
                "application/json": {
                    "example": {"detail": "Could not validate credentials"}
                }
            },
        },
        402: {
            "description": "Insufficient credits",
            "content": {
                "application/json": {"example": {"detail": "Insufficient credits"}}
            },
        },
        404: {
            "description": "User not found",
            "content": {"application/json": {"example": {"detail": "User not found"}}},
        },
    },
)
async def generate(
    req: AiRequest,
    user: User = Depends(async_verify_user),
    db: AsyncSession = Depends(get_async_session),
    flow_id: Optional[str] = None,
) -> Response:
    timeStart = time.time()

    user_row = await db.execute(select(UserModel).where(UserModel.user_id == user.id))
    user_row = user_row.scalar_one_or_none()

    if not user_row:
        raise HTTPException(status_code=404, detail="User not found")

    if int(user_row.credits) <= 0:
        raise HTTPException(status_code=402, detail="Insufficient credits")

    supported_models = await get_supported_models(db)
    print("supported_models", supported_models)
    if req.model not in supported_models:
        raise HTTPException(status_code=400, detail="Unsupported model")

    model_config = supported_models[req.model]
    original_req_model = req.model
    req.model = model_config.id
    print("req.model", req.model)

    machine = (await get_random_machines(1))[0]
    print("machine", machine)
    proxy_url = f"http://{machine.network_ip}:{PROXY_PORT}/v1/chat/completions"

    print("proxy_url", req.model_dump())
    async with httpx.AsyncClient(timeout=httpx.Timeout(60.0)) as client:
        llmres = await client.post(
            proxy_url,
            json=req.model_dump(),
            headers={"Accept-Encoding": "identity"},
        )

    async def generate():
        usage = {}
        result_text = ""
        current_tool_calls = {}
        ttfs: Optional[float] = None

        for line in llmres.iter_lines():
            print("line", line)
            # Handle line depending on whether it's bytes or string
            if isinstance(line, bytes):
                l = line.decode("utf-8")
            else:
                l = line

            if l.startswith("data: "):
                l = l[6:]
            try:
                json_line = json.loads(l)
                if "choices" in json_line:
                    choice = json_line["choices"][0]
                    if "delta" in choice:
                        delta = choice["delta"]
                        if "content" in delta and delta["content"] is not None:
                            result_text += delta["content"]
                            yield f"data: {json.dumps({'content': delta['content']})}\n\n"
                        if "tool_calls" in delta:
                            for tool_call in delta["tool_calls"]:
                                index = tool_call.get("index", 0)
                                if index not in current_tool_calls:
                                    current_tool_calls[index] = {
                                        "id": tool_call.get("id", ""),
                                        "type": tool_call.get("type", "function"),
                                        "function": {
                                            "name": tool_call.get("function", {}).get(
                                                "name", ""
                                            ),
                                            "arguments": tool_call.get(
                                                "function", {}
                                            ).get("arguments", ""),
                                        },
                                        "index": index,
                                    }
                                else:
                                    # Update existing tool call
                                    if "id" in tool_call:
                                        current_tool_calls[index]["id"] = tool_call[
                                            "id"
                                        ]
                                    if "function" in tool_call:
                                        if "name" in tool_call["function"]:
                                            current_tool_calls[index]["function"][
                                                "name"
                                            ] = tool_call["function"]["name"]
                                        if "arguments" in tool_call["function"]:
                                            current_tool_calls[index]["function"][
                                                "arguments"
                                            ] += tool_call["function"]["arguments"]

                            # Send the current state of tool calls
                            yield f"data: {json.dumps({'tool_calls': list(current_tool_calls.values())})}\n\n"
                if "usage" in json_line:
                    usage = json_line["usage"]
            except json.JSONDecodeError:
                pass
            except TypeError:
                # Handle potential TypeError when concatenating
                pass

            if ttfs is None:
                ttfs = time.time() - timeStart

            # Format response as SSE data
            if l.strip():
                yield f"data: {l}\n\n"

        await save_log(
            db=db,
            user=user,
            user_row=user_row,
            req=req,
            original_req_model=original_req_model,
            result_text=result_text,
            usage=usage,
            ttfs=ttfs,
            timeStart=timeStart,
            machine_id=machine.id,
            flow_id=flow_id,
        )

    if req.stream:
        res = StreamingResponse(generate(), media_type="text/event-stream")
    else:
        response_json = llmres.json()
        result_text = response_json["choices"][0]["message"]["content"]
        ttfs = time.time() - timeStart
        usage = response_json.get("usage", {})

        await save_log(
            db=db,
            user=user,
            user_row=user_row,
            req=req,
            original_req_model=original_req_model,
            result_text=result_text,
            usage=usage,
            ttfs=ttfs,
            timeStart=timeStart,
            machine_id=machine.id,
            flow_id=flow_id,
        )

        return Response(
            content=llmres.text,
            status_code=llmres.status_code,
            headers=dict(llmres.headers),
        )

    return res
