from datetime import datetime, timezone
from typing import Optional, AsyncGenerator, List, Dict, Any
from fastapi import APIRouter, Depends, Response, HTTPException, Request
from fastapi.responses import StreamingResponse
import httpx
from pydantic import BaseModel
from src.router.utils.user import get_user_credits
from src.router.utils.machine import get_machine_id
from src.router.core.config import (
    NODE_SERVICE_URL,
    DATA_STREAM_API_URL,
    DATA_STREAM_SERVICE_KEY,
    LITELLM_API_KEY,
)
from src.router.core.settings_types import SETTINGS_MODELS
from src.router.core.types import User
from src.router.db.session import DBSession
from src.router.core.security import verify_user
from src.router.utils.network import get_random_machines
from src.router.schemas.ai import AiRequest, VerifyRequest
import time
import json
import uuid
import uuid
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
    OPENSEARCH_LLM_USAGE_LOG_INDEX,
    opensearch_client,
    OPENSEARCH_CREDITS_INDEX,
)
from src.router.utils.nr import track
from openai import AsyncOpenAI


router = APIRouter()

# Configure OpenAI client for LiteLLM
openai_client = AsyncOpenAI(
    api_key=LITELLM_API_KEY, base_url="https://litellm.alts.dev/v1"
)


@router.post(
    "/v1/verify",
    summary="Verify Model Response",
    description=verify_doc["description"],
    response_description=verify_doc["response_description"],
    responses=verify_doc["responses"],
)
async def verify(req: VerifyRequest, db: DBSession, user: User = Depends(verify_user)):
    track(
        "verify_request",
        {
            "models_count": len(req.models),
            "min_yes": req.min_yes,
            "messages_count": len(req.messages),
        },
    )

    if len(req.models) < 1:
        track("verify_error", {"error": "no_models"})
        raise HTTPException(status_code=400, detail="At least one model is required")

    if req.min_yes < 1:
        track("verify_error", {"error": "invalid_min_yes", "min_yes": req.min_yes})
        raise HTTPException(status_code=400, detail="Minimum yes must be at least 1")

    if req.min_yes > len(req.models):
        track(
            "verify_error",
            {
                "error": "min_yes_too_high",
                "min_yes": req.min_yes,
                "models_count": len(req.models),
            },
        )
        raise HTTPException(
            status_code=400,
            detail="Minimum yes must be less than or equal to the number of models",
        )

    supported_models = await get_supported_models()

    # Validate and transform all models
    transformed_models = []
    for model in req.models:
        if model not in supported_models:
            track("verify_error", {"error": "unsupported_model", "model": model})
            raise HTTPException(status_code=400, detail=f"Unsupported model: {model}")
        model_config = supported_models[model]
        transformed_models.append({"original": model, "id": model_config.id})

    async def process_model(model, idx):
        try:
            # Get or create session ID
            # session_id = await get_or_create_session_id(str(user.id))

            # Define the verification tool for yes/no with reason
            verification_tool = {
                "type": "function",
                "function": {
                    "name": "provide_verification_result",
                    "description": "Provide a yes or no verification result with a detailed reason",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "result": {
                                "type": "string",
                                "enum": ["yes", "no"],
                                "description": "The verification result - either 'yes' or 'no'",
                            },
                            "reason": {
                                "type": "string",
                                "description": "Detailed explanation for the verification result",
                            },
                        },
                        "required": ["result", "reason"],
                    },
                },
            }

            # Create verification prompt
            verification_messages = [
                {
                    "role": "system",
                    "content": "You are a verification assistant. Analyze the conversation and provide a yes/no result with a detailed reason using the provided tool.",
                }
            ]
            verification_messages.extend(
                [{"role": msg.role, "content": msg.content} for msg in req.messages]
            )

            response = await openai_client.chat.completions.create(
                model=model["original"],
                messages=verification_messages,  # type: ignore
                tools=[verification_tool],  # type: ignore
                tool_choice={
                    "type": "function",
                    "function": {"name": "provide_verification_result"},
                },
                extra_body={
                    "metadata": {
                        "generation_name": "verify-generation-openai-client",
                        "generation_id": f"verify-gen-{user.id}-{idx}-{int(time.time())}",
                        "trace_id": f"verify-trace-{user.id}-{int(time.time())}",
                        "trace_user_id": str(user.id),
                        # "session_id": session_id
                    }
                },
            )

            # Extract verification result from tool call
            result = "no"
            reason = "No valid response received"

            if response.choices and response.choices[0].message.tool_calls:
                tool_call = response.choices[0].message.tool_calls[0]
                if tool_call.function.name == "provide_verification_result":
                    try:
                        args = json.loads(tool_call.function.arguments)
                        result = args.get("result", "no")
                        reason = args.get("reason", "No reason provided")
                    except (json.JSONDecodeError, KeyError):
                        result = "no"
                        reason = "Failed to parse verification result"

            return {
                "result": result,
                "response": {"choices": [{"message": {"content": reason}}]},
                "model": transformed_models[idx]["original"],
            }
        except Exception as e:
            logger.error(f"Error verifying model {model['id']}: {str(e)}")
            return {
                "result": "no",
                "reason": f"Error during verification: {str(e)}",
                "response": {"error": str(e)},
                "model": transformed_models[idx]["original"],
            }

    # Make parallel requests
    results = await asyncio.gather(
        *[process_model(model, idx) for idx, model in enumerate(transformed_models)]
    )

    yes_count = sum(1 for result in results if result["result"] == "yes")
    if yes_count >= req.min_yes:
        track("verify_response", {"result": "yes", "yes_count": yes_count})
        return {"result": "yes", "results": results}
    else:
        track("verify_response", {"result": "no", "yes_count": yes_count})
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
    track("list_models_request", {})

    supported_models = await get_supported_models()

    # Create a properly typed response
    response = ModelListRes(
        object="list",
        data=[
            ModelListResItem(id=model_id, object="model")
            for model_id, _ in supported_models.items()
        ],
    )

    track("list_models_response", {"models_count": len(supported_models)})

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
    track(
        "save_log",
        {
            "user_id": str(user.id),
            "model": original_req_model,
            "prompt_tokens": usage.get("prompt_tokens", 0),
            "completion_tokens": usage.get("completion_tokens", 0),
            "total_tokens": usage.get("total_tokens", 0),
            "ttfs": ttfs,
            "total_response_time": time.time() - timeStart,
            "has_flow_id": flow_id is not None,
        },
    )

    sm = await get_setting_value(
        "SUPPORTED_MODELS",
        SETTINGS_MODELS["SUPPORTED_MODELS"],
    )

    model_p = sm.root.get(original_req_model)

    if model_p is None:
        track(
            "save_log_error",
            {
                "user_id": str(user.id),
                "error": "model_not_found",
                "model": original_req_model,
            },
        )
        raise HTTPException(
            status_code=500, detail="Supported model not found in settings"
        )

    req.model = original_req_model

    # Calculate cost and reduce user credits
    prompt_tokens = usage.get("prompt_tokens", 0)
    completion_tokens = usage.get("completion_tokens", 0)
    total_tokens = usage.get("total_tokens", 0)

    prompt_tokens_cost = prompt_tokens * model_p.prompt_token
    completion_tokens_cost = completion_tokens * model_p.completion_token

    cost = prompt_tokens_cost + completion_tokens_cost

    # NEW: Use redis to manage user's credits instead of updating the db
    redis_key = f"user_credit:{user.id}"

    # new_credit = user_credits - cost
    await redis_client.incrbyfloat(redis_key, float(-cost))

    new_credit_bytes = await redis_client.get(redis_key)
    new_credit = float(new_credit_bytes.decode("utf-8")) if new_credit_bytes else 0.0

    # Prepare documents for OpenSearch
    llm_usage_doc = {
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
        "new_balance": str(new_credit),
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

    # Prepare data for data stream API
    data_stream_payload = {
        "event_name": "llm_usage",
        "user_id": str(user.id),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "properties": {
            "api_key_id": user.api_key_id,
            "log_id": str(uuid.uuid4()),
            "walletAddress": "0x0000000000000000000000000000000000000000",
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
            "previous_balance": user_credits,
            "new_balance": str(new_credit),
            "doc_type": "model_usage",
        },
    }

    async def send_to_data_stream():
        if not DATA_STREAM_API_URL or not DATA_STREAM_SERVICE_KEY:
            logger.warning(
                "DATA_STREAM_API_URL or DATA_STREAM_SERVICE_KEY not configured, skipping data stream logging"
            )
            return

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{DATA_STREAM_API_URL}/api/v1/track",
                    json=data_stream_payload,
                    headers={
                        "Write-Key": DATA_STREAM_SERVICE_KEY,
                        "Content-Type": "application/json",
                    },
                    timeout=5.0,  # 5 second timeout
                )
                if response.status_code != 200:
                    logger.error(
                        f"Failed to send log to data stream API: {response.status_code} {response.text}"
                    )
        except Exception as e:
            logger.error(f"Error sending log to data stream API: {str(e)}")

    try:
        # Send documents to OpenSearch and data stream API asynchronously
        await asyncio.gather(
            asyncio.get_event_loop().run_in_executor(
                None,
                lambda: opensearch_client.index(
                    index=OPENSEARCH_LLM_USAGE_LOG_INDEX,
                    body=llm_usage_doc,
                ),
            ),
            asyncio.get_event_loop().run_in_executor(
                None,
                lambda: opensearch_client.index(
                    index=OPENSEARCH_CREDITS_INDEX,
                    body=credit_history_doc,
                ),
            ),
            send_to_data_stream(),
        )
    except Exception as e:
        track("save_log_error", {"user_id": str(user.id), "error": str(e)})
        logger.error(f"Log saving error: {str(e)}")


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
    track(
        "generate_request",
        {
            "model": req.model,
            "stream": req.stream,
            "user_id": str(user.id),
            "has_flow_id": flow_id is not None,
            "messages_count": len(req.messages),
            "reasoning_effort": req.reasoning_effort,
        },
    )

    timeStart = time.time()

    try:
        # Fix type conversion for user_id
        user_credits = await get_user_credits(user.id, db)
        if user_credits <= 0:
            track(
                "generate_error",
                {
                    "user_id": str(user.id),
                    "error": "insufficient_credits",
                    "credits": user_credits,
                },
            )
            raise HTTPException(status_code=402, detail="Insufficient credits")

        supported_models = await get_supported_models()
        if req.model not in supported_models:
            track(
                "generate_error",
                {
                    "user_id": str(user.id),
                    "error": "unsupported_model",
                    "model": req.model,
                },
            )
            raise HTTPException(status_code=400, detail="Unsupported model")

        model_config = supported_models[req.model]
        original_req_model = req.model
        logger.info(f"Using LiteLLM service with OpenAI client {req.model}")
        req.model = model_config.id
        logger.info(f"Using LiteLLM service with OpenAI client {req.model}")

        # Prepare messages in OpenAI format
        messages = [
            {"role": msg.role, "content": msg.content}  # type: ignore
            for msg in req.messages
        ]

        # Common parameters for OpenAI client
        completion_params: Dict[str, Any] = {
            "model": original_req_model,
            "messages": messages,
            "stream": req.stream,
        }

        # Add optional parameters if they exist
        if req.max_tokens:
            completion_params["max_tokens"] = req.max_tokens

        # Get or create session ID for Langfuse tracking
        # session_id = await get_or_create_session_id(str(user.id))

        # logger.info(f"Session ID: {session_id}")
        logger.info(f"User ID: {user.id}")

        # Add metadata for tracking
        completion_params["extra_body"] = {
            "metadata": {
                "generation_name": "chat-completion-openai-client",
                "generation_id": f"chat-gen-{user.id}-{int(time.time())}",
                "trace_id": f"chat-trace-{user.id}-{int(time.time())}",
                "trace_user_id": str(user.id),
                # "session_id": session_id
            }
        }

        if req.stream:

            async def generate():
                usage = {}
                result_text = ""
                ttfs: Optional[float] = None
                machine_id = 0

                try:
                    stream = await openai_client.chat.completions.create(
                        **completion_params,
                        stream_options={
                            "include_usage": True,
                        },
                        timeout=5,
                    )

                    async for chunk in stream:
                        if ttfs is None:
                            ttfs = time.time() - timeStart
                            track(
                                "generate_first_token",
                                {
                                    "user_id": str(user.id),
                                    "model": original_req_model,
                                    "ttfs": ttfs,
                                    "stream": req.stream,
                                },
                            )

                        # Convert OpenAI chunk to SSE format
                        chunk_dict = chunk.model_dump()

                        if chunk.choices and chunk.choices[0].delta.content:
                            result_text += chunk.choices[0].delta.content

                        # Check for usage information (usually in the last chunk)
                        if hasattr(chunk, "usage") and chunk.usage:
                            usage = chunk.usage.model_dump()

                        yield f"data: {json.dumps(chunk_dict)}\n\n"

                except Exception as e:
                    track(
                        "generate_stream_error",
                        {"user_id": str(user.id), "error": str(e)},
                    )
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
                            machine_id=machine_id,
                            flow_id=flow_id,
                        )

                    except Exception as log_error:
                        track(
                            "generate_log_error",
                            {"user_id": str(user.id), "error": str(log_error)},
                        )
                        logger.error(f"Log saving error: {str(log_error)}")

            return StreamingResponse(
                generate(),
                media_type="text/event-stream",
                headers={
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                },
            )

        # Handle non-streaming response
        try:
            response = await openai_client.chat.completions.create(
                **completion_params, timeout=1
            )

            result_text = (
                response.choices[0].message.content if response.choices else ""
            )
            ttfs = time.time() - timeStart
            usage = response.usage.model_dump() if response.usage else {}

            track(
                "generate_completion",
                {
                    "user_id": str(user.id),
                    "model": original_req_model,
                    "ttfs": ttfs,
                    "prompt_tokens": usage.get("prompt_tokens", 0),
                    "completion_tokens": usage.get("completion_tokens", 0),
                    "total_tokens": usage.get("total_tokens", 0),
                },
            )

            # For LiteLLM, set machine_id to 0 since we don't have machine info
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

            # Convert response to match expected format
            response_dict = response.model_dump()
            return Response(
                content=json.dumps(response_dict),
                status_code=200,
                media_type="application/json",
            )

        except Exception as e:
            track("generate_error", {"user_id": str(user.id), "error": str(e)})
            logger.error(f"Non-streaming generation error: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=f"Error processing request: {str(e)}",
            )

    except Exception as e:
        track("generate_error", {"user_id": str(user.id), "error": str(e)})
        logger.error(f"Request processing error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error processing request: {str(e)}",
        )


async def get_or_create_session_id(user_id: str) -> str:
    """Get existing session ID from Redis or create a new one with 30-minute expiration"""
    redis_key = f"user_session:{user_id}"
    session_id = await redis_client.get(redis_key)

    if session_id is None:
        # Create new session ID
        session_id = f"session_{user_id}_{uuid.uuid4().hex[:12]}"
        # Store in Redis with 30-minute (1800 seconds) expiration
        await redis_client.setex(redis_key, 1800, session_id)
    else:
        # Extend existing session by 30 minutes
        session_id = (
            session_id.decode("utf-8") if isinstance(session_id, bytes) else session_id
        )
        await redis_client.expire(redis_key, 1800)

    return session_id
