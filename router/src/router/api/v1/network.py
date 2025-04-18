from datetime import datetime, timezone
from typing import Optional, AsyncGenerator
from fastapi import APIRouter, Depends, Response, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse, FileResponse, RedirectResponse
from pydantic import BaseModel
from src.router.utils.user import get_user_credits
from src.router.utils.machine import get_machine_id
from src.router.core.config import NODE_SERVICE_URL, S3_PREFIX
from src.router.core.settings_types import SETTINGS_MODELS
from src.router.core.types import User
from src.router.db.session import DBSession
from src.router.core.security import verify_user
from src.router.utils.network import get_random_machines
from src.router.schemas.ai import AiRequest, VerifyRequest
from src.router.utils.s3 import upload_file_to_s3, get_file_from_s3, get_s3_key
import time
import httpx
import json
from src.router.utils.settings import get_setting_value
from src.router.utils.settings import get_supported_models
import asyncio
from src.router.utils.redis import redis_client
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
from aiohttp import ClientSession, ClientTimeout, TCPConnector
import shutil
import os
import uuid
from pathlib import Path
import mimetypes
from src.router.utils.nr import track


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
    track("verify_request", {
        "models_count": len(req.models),
        "min_yes": req.min_yes,
        "messages_count": len(req.messages)
    })
    
    if len(req.models) < 1:
        track("verify_error", {"error": "no_models"})
        raise HTTPException(status_code=400, detail="At least one model is required")

    if req.min_yes < 1:
        track("verify_error", {"error": "invalid_min_yes", "min_yes": req.min_yes})
        raise HTTPException(status_code=400, detail="Minimum yes must be at least 1")

    if req.min_yes > len(req.models):
        track("verify_error", {
            "error": "min_yes_too_high", 
            "min_yes": req.min_yes, 
            "models_count": len(req.models)
        })
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
        proxy_url = f"{NODE_SERVICE_URL}/v1/verify"
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
        track("verify_response", {"result": "yes", "yes_count": yes_count})
        return {"result": "yes", "results": results}
    else:
        track("verify_response", {"result": "no", "yes_count": yes_count})
        return {"result": "no", "results": results}


class ModelListResItem(BaseModel):
    id: str
    object: str
    vision: bool


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
            ModelListResItem(
                id=model_id,
                object="model",
                vision=model_config.capabilities.get("vision", False),
            )
            for model_id, model_config in supported_models.items()
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
    track("save_log", {
        "user_id": str(user.id),
        "model": original_req_model,
        "prompt_tokens": usage.get("prompt_tokens", 0),
        "completion_tokens": usage.get("completion_tokens", 0),
        "total_tokens": usage.get("total_tokens", 0),
        "ttfs": ttfs,
        "total_response_time": time.time() - timeStart,
        "has_flow_id": flow_id is not None
    })
    
    sm = await get_setting_value(
        "SUPPORTED_MODELS",
        SETTINGS_MODELS["SUPPORTED_MODELS"],
    )

    model_p = sm.root.get(original_req_model)

    if model_p is None:
        track("save_log_error", {
            "user_id": str(user.id),
            "error": "model_not_found",
            "model": original_req_model
        })
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

    try:
        # Send both documents to OpenSearch asynchronously
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
        )
    except Exception as e:
        track("save_log_error", {
            "user_id": str(user.id),
            "error": str(e)
        })
        logger.error(f"Log saving error: {str(e)}")


async def handle_stream_chunk(
    chunk: str | bytes,
) -> AsyncGenerator[tuple[str, dict], None]:
    buffer = ""
    try:
        # Convert bytes to text
        if isinstance(chunk, bytes):
            text = chunk.decode("utf-8")
        else:
            text = str(chunk)

        buffer += text

        while True:
            # Find the next complete SSE line
            line_end = buffer.find("\n")
            if line_end == -1:
                break

            line = buffer[:line_end].strip()
            buffer = buffer[line_end + 1 :]

            if not line:
                continue

            # Handle SSE format
            if line.startswith("data: "):
                data = line[6:]
                if data == "[DONE]":
                    break

                try:
                    json_data = json.loads(data)

                    # Yield both content chunks and usage data
                    if (
                        json_data.get("choices", [{}])[0]
                        .get("delta", {})
                        .get("content")
                        or "usage" in json_data
                    ):
                        yield f"data: {json.dumps(json_data)}\n\n", json_data
                except json.JSONDecodeError:
                    logger.debug(f"Incomplete JSON chunk (expected): {data}")
                    continue
            else:
                continue

    except Exception as e:
        track("stream_chunk_error", {"error": str(e)})
        logger.error(f"Stream chunk processing error: {str(e)}")
        yield f"data: {json.dumps({'error': str(e)})}\n\n", {"error": str(e)}


async def stream_response(response) -> AsyncGenerator[tuple[str, dict], None]:
    """Stream response handler with proper chunk size and decoding"""
    try:
        # Use 1024 bytes chunk size and decode to unicode, similar to requests
        async for chunk in response.content.iter_any():
            if isinstance(chunk, bytes):
                text = chunk.decode("utf-8")
            else:
                text = str(chunk)
            async for message, data in handle_stream_chunk(text):
                yield message, data
    except Exception as e:
        track("stream_response_error", {"error": str(e)})
        logger.error(f"Streaming error: {str(e)}")
        yield f"data: {json.dumps({'error': str(e)})}\n\n", {"error": str(e)}


@router.get(
    "/v1/image/{filename}",
    summary="Get uploaded image",
    description="Retrieves an image file from S3 storage and returns a presigned URL for direct access.",
    responses={
        307: {"description": "Temporary redirect to presigned S3 URL"},
        404: {"description": "Image not found"},
        500: {"description": "Failed to access file in S3"},
    },
)
async def get_image(filename: str):
    """
    Retrieves an image from S3 storage and returns a presigned URL.
    """
    try:
        # Basic security: Ensure filename is just a filename, no path components
        if "/" in filename or "\\" in filename or ".." in filename:
            logger.warning(
                f"Invalid characters or path traversal attempt in filename: {filename}"
            )
            raise HTTPException(status_code=400, detail="Invalid filename")

        # Get S3 key for the file
        s3_key = get_s3_key(filename)

        # Get file metadata and presigned URL from S3
        file_data = await get_file_from_s3(s3_key)
        if not file_data:
            logger.warning(f"Image not found in S3: {filename}")
            raise HTTPException(status_code=404, detail="Image not found")

        # Redirect to presigned URL
        return RedirectResponse(url=file_data["presigned_url"], status_code=307)

    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        logger.error(f"Error serving image {filename}: {e}")
        raise HTTPException(
            status_code=500, detail="Internal server error serving image"
        )


@router.post(
    "/v1/upload/image",
    summary="Upload an image file",
    description="Uploads an image file to S3 storage and returns the URL for accessing it.",
    response_description="Returns the URL of the uploaded image.",
)
async def upload_image(
    file: UploadFile = File(...),
    user: User = Depends(verify_user),
):
    """
    Handles image uploads to S3 storage.
    """
    try:
        # Limit file types
        allowed_content_types = ["image/jpeg", "image/png", "image/webp", "image/gif"]
        if file.content_type not in allowed_content_types:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid file type. Allowed types: {', '.join(allowed_content_types)}",
            )

        # Generate a unique filename
        file_extension = os.path.splitext(file.filename)[1] if file.filename else ".png"
        unique_filename = f"{uuid.uuid4()}{file_extension}"

        # Upload to S3
        s3_key, public_url = await upload_file_to_s3(
            file.file, unique_filename, file.content_type
        )

        logger.info(f"User {user.id} uploaded file: {unique_filename} to S3")

        # Return the filename for constructing the GET endpoint URL
        return {
            "filename": unique_filename,
            "url": f"/v1/image/{unique_filename}",  # Relative URL for API endpoint
            "s3_url": public_url,  # Direct S3 URL (if needed)
        }

    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        logger.error(f"Failed to upload file for user {user.id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to upload file: {str(e)}")
    finally:
        await file.close()


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
    track("generate_request", {
        "model": req.model,
        "stream": req.stream,
        "user_id": str(user.id),
        "has_flow_id": flow_id is not None,
        "messages_count": len(req.messages)
    })

    timeStart = time.time()

    try:
        # Get user credits
        user_credits = await get_user_credits(user.id, db)
        if user_credits <= 0:
            track("generate_error", {
                "user_id": str(user.id),
                "error": "insufficient_credits",
                "credits": user_credits
            })
            raise HTTPException(status_code=402, detail="Insufficient credits")

        supported_models = await get_supported_models()
        if req.model not in supported_models:
            track("generate_error", {
                "user_id": str(user.id),
                "error": "unsupported_model",
                "model": req.model
            })
            raise HTTPException(status_code=400, detail="Unsupported model")

        model_config = supported_models[req.model]
        original_req_model = req.model
        req.model = model_config.id

        # # Check messages for image_urls and handle S3 paths
        # logger.info("Checking messages for image URLs...")
        # for message in req.messages:
        #     if isinstance(message.content, list):
        #         for part in message.content:
        #             if isinstance(part, dict) and part.get("type") == "image_url":
        #                 image_url_data = part.get("image_url", {})
        #                 url_str = image_url_data.get("url")
        #                 if isinstance(url_str, str) and url_str.startswith("/v1/image/"):
        #                     # Extract filename from the API endpoint URL
        #                     filename = url_str.split("/")[-1]
        #                     # Get S3 presigned URL
        #                     file_data = await get_file_from_s3(get_s3_key(filename))
        #                     if file_data:
        #                         # Replace the URL with the presigned S3 URL
        #                         part["image_url"]["url"] = file_data["presigned_url"]
        #                         logger.debug(f"Replaced {url_str} with presigned S3 URL")
        #                     else:
        #                         logger.warning(f"Image file not found in S3: {filename}")

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

            async with ClientSession(connector=connector, timeout=timeout) as session:
                try:
                    llmres = await session.post(
                        proxy_url,
                        json=req.model_dump(),
                        headers={"Accept-Encoding": "identity"},
                    )
                    llmres.raise_for_status()

                    machine_ip = llmres.headers.get("x-machine-ip", "")
                    if not machine_ip:
                        logger.warning("No machine IP in headers")
                        machine_ip = ""

                    try:
                        machine_id = int(await get_machine_id(machine_ip, db))
                    except (ValueError, TypeError) as e:
                        logger.error(f"Error converting machine_id: {str(e)}")
                        machine_id = 0

                    async for message, data in stream_response(llmres):
                        if ttfs is None:
                            ttfs = time.time() - timeStart
                            track("generate_first_token", {
                                "user_id": str(user.id),
                                "model": original_req_model,
                                "ttfs": ttfs,
                                "stream": req.stream
                            })

                        if "usage" in data:
                            usage = data["usage"]

                        yield message

                except Exception as e:
                    track("generate_stream_error", {
                        "user_id": str(user.id),
                        "error": str(e)
                    })
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
                        track("generate_log_error", {
                            "user_id": str(user.id),
                            "error": str(log_error)
                        })
                        logger.error(f"Log saving error: {str(log_error)}")

        if req.stream:
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
            
            track("generate_completion", {
                "user_id": str(user.id),
                "model": original_req_model,
                "ttfs": ttfs,
                "prompt_tokens": usage.get("prompt_tokens", 0),
                "completion_tokens": usage.get("completion_tokens", 0),
                "total_tokens": usage.get("total_tokens", 0)
            })

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
        track("generate_error", {
            "user_id": str(user.id),
            "error": str(e)
        })
        logger.error(f"Request processing error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error processing request: {str(e)}",
        )
