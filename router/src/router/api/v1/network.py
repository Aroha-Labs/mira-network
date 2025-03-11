from datetime import datetime, timezone
from typing import Optional, AsyncGenerator
from fastapi import APIRouter, Depends, Response, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from src.router.utils.user import get_user_credits
from src.router.utils.machine import get_machine_id
from src.router.core.config import NODE_SERVICE_URL
from src.router.core.settings_types import SETTINGS_MODELS
from src.router.core.types import User
from src.router.db.session import DBSession
from src.router.core.security import verify_user
from src.router.utils.network import get_random_machines
from src.router.schemas.ai import AiRequest, VerifyRequest
import time
import httpx
import json
from src.router.utils.settings import get_setting_value
from src.router.utils.settings import get_supported_models
import asyncio
from src.router.utils.redis import redis_client  # new import for redis
from src.router.utils.logger import logger
from src.router.api.v1.docs.network import (
    chatCompletionGenerateDoc,
    list_models_doc,
    verify_doc,
)
from src.router.utils.opensearch import (
    opensearch_client,
    OPENSEARCH_MODEL_USAGE_INDEX,
    OPENSEARCH_CREDITS_INDEX,
)
from aiohttp import (
    ClientSession,
    ClientTimeout,
    ClientPayloadError,
    ServerDisconnectedError,
    TCPConnector,
)


router = APIRouter()

transport = httpx.AsyncHTTPTransport(retries=3)


@router.post(
    "/v1/verify",
    summary="Verify Model Response",
    description=verify_doc["description"],
    response_description=verify_doc["response_description"],
    responses=verify_doc["responses"],
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

    req.model = original_req_model

    # Calculate cost and reduce user credits
    prompt_tokens = usage.get("prompt_tokens", 0)
    completion_tokens = usage.get("completion_tokens", 0)
    total_tokens = usage.get("total_tokens", 0)

    logger.info(f"Prompt tokens: {prompt_tokens}")
    logger.info(f"Completion tokens: {completion_tokens}")
    logger.info(f"Total tokens: {total_tokens}")

    prompt_tokens_cost = prompt_tokens * model_p.prompt_token
    completion_tokens_cost = completion_tokens * model_p.completion_token

    logger.info(f"Prompt tokens cost: {prompt_tokens_cost}")
    logger.info(f"Completion tokens cost: {completion_tokens_cost}")

    cost = prompt_tokens_cost + completion_tokens_cost

    # NEW: Use redis to manage user's credits instead of updating the db
    redis_key = f"user_credit:{user.id}"
    # new_credit = user_credits - cost
    logger.info(f"Cost: {-cost}")
    await redis_client.incrbyfloat(redis_key, float(-cost))

    new_credit = await redis_client.get(redis_key)

    logger.info(f"New credit: {new_credit}")

    # Prepare documents for OpenSearch
    model_usage_doc = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "user_id": user.id,
        "api_key_id": user.api_key_id,
        "model": req.model,
        "original_model": original_req_model,
        "prompt_tokens": usage.get("prompt_tokens", 0),
        "completion_tokens": usage.get("completion_tokens", 0),
        "total_tokens": usage.get("total_tokens", 0),
        "ttft": ttfs,
        "total_response_time": time.time() - timeStart,
        "machine_id": str(machine_id),
        "flow_id": flow_id,
        "cost": cost,
        "request": req.model_dump(),
        "response": result_text,
        "doc_type": "model_usage",
    }

    credit_history_doc = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "user_id": user.id,
        "doc_type": "credit_history",
        "amount": -cost,
        "previous_balance": user_credits,
        "new_balance": new_credit,
        "model": original_req_model,
        "machine_id": str(machine_id),
        "flow_id": flow_id,
        "tokens": {
            "prompt": prompt_tokens,
            "completion": completion_tokens,
            "total": total_tokens,
        },
        "costs": {
            "prompt": prompt_tokens_cost,
            "completion": completion_tokens_cost,
            "total": cost,
        },
        "metrics": {
            "ttft": ttfs,
            "total_response_time": time.time() - timeStart,
        },
        "description": f"Used {total_tokens} tokens. Prompt tokens: {prompt_tokens}, Completion tokens: {completion_tokens}",
    }

    try:
        # Send both documents to OpenSearch asynchronously
        await asyncio.gather(
            asyncio.get_event_loop().run_in_executor(
                None,
                lambda: opensearch_client.index(
                    index=OPENSEARCH_MODEL_USAGE_INDEX,
                    body=model_usage_doc,
                ),
            ),
            asyncio.get_event_loop().run_in_executor(
                None,
                lambda: opensearch_client.index(
                    index=OPENSEARCH_CREDITS_INDEX,
                    body=credit_history_doc,
                ),
            ),
        )
    except Exception as e:
        logger.error(f"Log saving error: {str(e)}")


async def handle_stream_chunk(chunk: bytes) -> AsyncGenerator[str, None]:
    """Handle individual chunks with proper error handling and parsing"""
    try:
        # Convert bytes to text
        if isinstance(chunk, bytes):
            text = chunk.decode("utf-8")
        else:
            text = str(chunk)

        # Split into lines and process each
        lines = text.split("\n")
        for line in lines:
            line = line.strip()
            if not line:
                continue

            # Handle SSE format
            if line.startswith("data: "):
                line = line[6:]

            try:
                # Try to parse as JSON
                json_data = json.loads(line)
                yield f"data: {json.dumps(json_data)}\n\n"
            except json.JSONDecodeError:
                # If not JSON, send as raw data
                if line.strip():
                    yield f"data: {json.dumps({'raw': line})}\n\n"

            if "usage" in json_data:
                logger.info(f"Usage: {json_data['usage']}")
                usage = json_data["usage"]
                logger.info(f"Usage: {usage}")
    except Exception as e:
        logger.error(f"Stream chunk processing error: {str(e)}")
        yield f"data: {json.dumps({'error': str(e)})}\n\n"


async def stream_response(response) -> AsyncGenerator[str, None]:
    """Simple streaming response handler"""
    try:
        async for chunk in response.content.iter_chunked(1024):
            async for processed_chunk in handle_stream_chunk(chunk):
                yield processed_chunk
    except Exception as e:
        logger.error(f"Streaming error: {str(e)}")
        yield f"data: {json.dumps({'error': str(e)})}\n\n"


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

    try:
        # Fix type conversion for user_id
        user_credits = await get_user_credits((user.id), db)
        if user_credits <= 0:
            raise HTTPException(status_code=402, detail="Insufficient credits")

        supported_models = await get_supported_models()
        if req.model not in supported_models:
            raise HTTPException(status_code=400, detail="Unsupported model")

        model_config = supported_models[req.model]
        original_req_model = req.model
        req.model = model_config.id

        proxy_url = f"{NODE_SERVICE_URL}/v1/chat/completions"
        logger.info(f"Using machine {NODE_SERVICE_URL}")

        # Create timeout configuration
        timeout = ClientTimeout(
            total=300.0, connect=60.0, sock_connect=30.0, sock_read=60.0
        )

        connector = TCPConnector(
            limit=3000,  # For 100 req/sec minimum
            limit_per_host=500,  # Prevent single host overwhelming
        )

        async def generate():
            usage = {}
            result_text = ""
            current_tool_calls = {}
            ttfs: Optional[float] = None
            machine_id = None

            # Create session inside the generator to ensure it stays open during streaming
            async with ClientSession(connector=connector, timeout=timeout) as session:
                try:
                    llmres = await session.post(
                        proxy_url,
                        json=req.model_dump(),
                        headers={"Accept-Encoding": "identity"},
                    )
                    llmres.raise_for_status()
                    logger.info(f"Received response with status {llmres.status}")

                    # Get machine_id early to handle potential None
                    machine_ip = llmres.headers.get("x-machine-ip", "")
                    if not machine_ip:
                        logger.warning("No machine IP in headers")
                        machine_ip = ""

                    try:
                        machine_id = int(await get_machine_id(machine_ip, db))
                    except (ValueError, TypeError) as e:
                        logger.error(f"Error converting machine_id: {str(e)}")
                        machine_id = 0

                    async for data in stream_response(llmres):
                        if ttfs is None:
                            ttfs = time.time() - timeStart
                            logger.info(f"TTFS: {ttfs:.2f}s")

                        # Only update usage if it's in the data
                        try:
                            json_data = json.loads(data.replace("data: ", ""))
                            if "usage" in json_data:
                                usage = json_data["usage"]
                        except (json.JSONDecodeError, KeyError):
                            pass

                        yield data

                except Exception as e:
                    logger.error(f"Generation error: {str(e)}")
                    yield f"data: {json.dumps({'error': str(e)})}\n\n"
                finally:
                    try:
                        # Save logs with proper error handling
                        await save_log(
                            user=user,
                            user_credits=user_credits,
                            req=req,
                            original_req_model=original_req_model,
                            result_text=result_text,
                            usage=usage,
                            ttfs=ttfs,
                            timeStart=timeStart,
                            machine_id=machine_id or 0,
                            flow_id=flow_id,
                        )
                    except Exception as log_error:
                        logger.error(f"Log saving error: {str(log_error)}")

        if req.stream:
            logger.info("Starting streaming response")
            return StreamingResponse(
                generate(),
                media_type="text/event-stream",
                headers={
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                },
            )

        # Handle non-streaming response
        async with ClientSession(connector=connector, timeout=timeout) as session:
            llmres = await session.post(
                proxy_url,
                json=req.model_dump(),
                headers={"Accept-Encoding": "identity"},
            )
            llmres.raise_for_status()

            response_text = await llmres.text()
            response_json = json.loads(response_text)
            content_json = response_json.get("data", response_json)
            result_text = content_json["choices"][0]["message"]["content"]
            ttfs = time.time() - timeStart
            usage = content_json.get("usage", {})

            # Handle machine_id safely
            machine_ip = llmres.headers.get("x-machine-ip", "")
            try:
                machine_id = int(await get_machine_id(machine_ip, db))
            except (ValueError, TypeError):
                machine_id = 0

            await save_log(
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

            return Response(
                content=response_text,
                status_code=200,
            )

    except Exception as e:
        logger.error(f"Request processing error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error processing request: {str(e)}",
        )
