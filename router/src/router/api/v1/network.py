from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, Response, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlmodel import select
from src.router.utils.machine import get_machine_id
from src.router.core.config import NODE_SERVICE_URL
from src.router.core.settings_types import SETTINGS_MODELS
from src.router.core.types import ModelPricing, User
from src.router.models.logs import ApiLogs
from src.router.db.session import DBSession
from src.router.core.security import verify_user
from src.router.utils.network import get_random_machines
from src.router.models.user import User as UserModel, UserCreditsHistory
from src.router.schemas.ai import AiRequest, VerifyRequest
import time
import httpx
import json
from src.router.utils.settings import get_setting_value
from src.router.utils.settings import get_supported_models
import asyncio
from src.router.utils.redis import redis_client  # new import for redis
from src.router.utils.logger import logger
from src.router.api.v1.docs.network import chatCompletionGenerateDoc, list_models_doc

router = APIRouter()

transport = httpx.AsyncHTTPTransport(retries=3)


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
async def verify(req: VerifyRequest, db: DBSession):
    if len(req.models) < 1:
        raise HTTPException(status_code=400, detail="At least one model is required")

    if req.min_yes < 1:
        raise HTTPException(status_code=400, detail="Minimum yes must be at least 1")

    if req.min_yes > len(req.models):
        raise HTTPException(
            status_code=400,
            detail="Minimum yes must be less than or equal to the number of models",
        )

    supported_models = await get_supported_models()

    # Validate and transform all models
    transformed_models = []
    for model in req.models:
        if model not in supported_models:
            raise HTTPException(status_code=400, detail=f"Unsupported model: {model}")
        model_config = supported_models[model]
        transformed_models.append({"original": model, "id": model_config.id})

    async def process_model(model, idx):
        machine = await get_random_machines(db, 1)
        proxy_url = f"http://{machine[0].network_ip}:34523/v1/verify"
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
    description=list_models_doc["description"],
    response_description="Returns an array of available model information",
    responses=list_models_doc["responses"],
)
async def list_models() -> ModelListRes:
    supported_models = await get_supported_models()

    # Create a properly typed response
    response = ModelListRes(
        object="list",
        data=[
            ModelListResItem(id=model_id, object="model")
            for model_id, _ in supported_models.items()
        ],
    )

    return response


async def get_user_credits(user_id: int, db: DBSession):
    redis_key = f"user_credit:{user_id}"
    current_credit = await redis_client.get(redis_key)

    if current_credit is not None:
        current_credit = float(current_credit)
        return current_credit

    user_credits = await db.exec(
        select(UserModel.credits).where(UserModel.user_id == user_id)
    )
    user_credits = user_credits.one_or_none()
    if user_credits is None:
        raise HTTPException(status_code=404, detail="User not found")

    current_credit = user_credits
    await redis_client.set(redis_key, current_credit)
    return current_credit


async def save_log(
    user: User,
    user_credits: float,
    req: AiRequest,
    original_req_model: str,
    result_text: str,
    usage: dict,
    ttfs: Optional[float],
    timeStart: float,
    machine_id: int,
    flow_id: Optional[str] = None,
):
    sm = await get_setting_value(
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

    # Calculate cost and reduce user credits
    prompt_tokens = usage.get("prompt_tokens", 0)
    completion_tokens = usage.get("completion_tokens", 0)
    total_tokens = usage.get("total_tokens", 0)

    prompt_tokens_cost = prompt_tokens * model_p.prompt_token
    completion_tokens_cost = completion_tokens * model_p.completion_token

    cost = prompt_tokens_cost + completion_tokens_cost

    # NEW: Use redis to manage user's credits instead of updating the db
    redis_key = f"user_credit:{user.id}"
    new_credit = user_credits - cost

    await redis_client.set(redis_key, new_credit)

    # Update user credit history
    user_credits_history = UserCreditsHistory(
        user_id=user.id,
        amount=-cost,
        description=f"Used {total_tokens} tokens. Prompt tokens: {prompt_tokens}, Completion tokens: {completion_tokens}",
        created_at=datetime.now(timezone.utc).replace(tzinfo=None),
    )

    return api_log, user_credits_history


@router.post(
    "/v1/chat/completions",
    summary="Generate Chat Completion",
    description=chatCompletionGenerateDoc["description"],
    response_description="Returns the model's completion response",
    responses=chatCompletionGenerateDoc["responses"],
)
async def chatCompletionGenerate(
    req: AiRequest,
    db: DBSession,
    user: User = Depends(verify_user),
    flow_id: Optional[str] = None,
) -> Response:
    timeStart = time.time()

    user_credits = await get_user_credits(user.id, db)
    if user_credits <= 0:
        raise HTTPException(status_code=402, detail="Insufficient credits")

    supported_models = await get_supported_models()
    if req.model not in supported_models:
        raise HTTPException(status_code=400, detail="Unsupported model")

    model_config = supported_models[req.model]
    original_req_model = req.model
    req.model = model_config.id

    # machine = (await get_random_machines(db, 1))[0]
    # print("machine", machine)
    proxy_url = f"{NODE_SERVICE_URL}/v1/chat/completions"
    logger.info(f"Using machine {NODE_SERVICE_URL}")

    # Create a client with increased timeouts and retries
    async with httpx.AsyncClient(
        timeout=httpx.Timeout(connect=60.0, read=120.0, write=60.0, pool=180.0),
        transport=httpx.AsyncHTTPTransport(retries=5),
    ) as client:
        try:
            logger.info(f"Sending request to {proxy_url}")
            llmres = await client.post(
                proxy_url,
                json=req.model_dump(),
                headers={"Accept-Encoding": "identity"},
            )
            llmres.raise_for_status()
            logger.info(f"Received response with status {llmres.status_code}")
        except httpx.ReadError as e:
            logger.error(f"Read error connecting to service at {proxy_url}: {str(e)}")
            # Try with a different machine as fallback
            raise HTTPException(
                status_code=503,
                detail="Service temporarily unavailable. Please try again later.",
            )
        except httpx.TimeoutException as e:
            logger.error(f"Timeout error: {str(e)}")
            raise HTTPException(
                status_code=504,
                detail="Request timed out. The service is experiencing high load.",
            )
        except Exception as e:
            logger.error(f"Error generating with proxy_url {proxy_url}: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    async def generate():
        usage = {}
        result_text = ""
        current_tool_calls = {}
        ttfs: Optional[float] = None

        try:
            for line in llmres.iter_lines():
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
                                                "name": tool_call.get(
                                                    "function", {}
                                                ).get("name", ""),
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

                if ttfs is None:
                    ttfs = time.time() - timeStart
                    logger.info(f"TTFS: {ttfs:.2f}s")

                # Format response as SSE data
                if l.strip():
                    yield f"data: {l}\n\n"

            logger.info("Completed streaming response")
        except Exception as e:
            logger.error(f"Error during streaming: {str(e)}")
            # Send error to client
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
        finally:
            # Always save log even if streaming fails
            try:
                # get machine_id from ip address of llmres
                machine_ip = llmres.headers.get("X-Machine-IP")
                logger.info(f"Machine IP: {machine_ip}")

                # get machine_id from redis
                machine_id = await get_machine_id(machine_ip, db)
                logger.info(f"Machine ID: {machine_id}")

                api_log, user_credit_history = await save_log(
                    user=user,
                    user_credits=user_credits,
                    req=req,
                    original_req_model=original_req_model,
                    result_text=result_text,
                    usage=usage,
                    ttfs=ttfs,
                    timeStart=timeStart,
                    machine_id=machine_id,
                    flow_id=flow_id,
                )

                db.add(api_log)
                db.add(user_credit_history)
                await db.commit()
            except Exception as log_error:
                logger.error(f"Error saving log: {str(log_error)}")

    if req.stream:
        logger.info("Starting streaming response")
        res = StreamingResponse(generate(), media_type="text/event-stream")
        return res

    try:
        response_json = llmres.json()
        result_text = response_json["choices"][0]["message"]["content"]
        ttfs = time.time() - timeStart
        usage = response_json.get("usage", {})

        logger.info(
            f"Non-streaming response complete in {time.time() - timeStart:.2f}s"
        )

        machine_ip = llmres.headers.get("X-Machine-IP")
        logger.info(f"Machine IP: {machine_ip}")

        # get machine_id from redis
        machine_id = await get_machine_id(machine_ip, db)

        logger.info(f"Machine ID: {machine_id}")

        api_log, user_credit_history = await save_log(
            user=user,
            user_credits=user_credits,
            req=req,
            original_req_model=original_req_model,
            result_text=result_text,
            usage=usage,
            ttfs=ttfs,
            timeStart=timeStart,
            machine_id=machine_id,
            flow_id=flow_id,
        )

        db.add(api_log)
        db.add(user_credit_history)
        await db.commit()

        return Response(
            content=llmres.text,
            status_code=llmres.status_code,
        )
    except Exception as e:
        logger.error(f"Error processing non-streaming response: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error processing response: {str(e)}",
        )
