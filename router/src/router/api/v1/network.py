from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, Response, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlmodel import Session, select
from src.router.core.settings_types import SETTINGS_MODELS
from src.router.core.types import ModelPricing, User
from src.router.models.logs import ApiLogs
from src.router.db.session import get_session
from src.router.core.security import verify_user
from src.router.utils.network import get_random_machines, PROXY_PORT
from src.router.models.user import User as UserModel, UserCreditsHistory
from src.router.schemas.ai import AiRequest, VerifyRequest
import requests
import time
import httpx
import json
from src.router.utils.settings import get_setting_value
from src.router.utils.settings import get_supported_models

router = APIRouter()


@router.post("/v1/verify", tags=["network"])
async def verify(req: VerifyRequest):
    if len(req.models) < 1:
        raise HTTPException(status_code=400, detail="At least one model is required")

    if req.min_yes < 1:
        raise HTTPException(status_code=400, detail="Minimum yes must be at least 1")

    if req.min_yes > len(req.models):
        raise HTTPException(
            status_code=400,
            detail="Minimum yes must be less than or equal to the number of models",
        )

    machines = get_random_machines(len(req.models))

    results = []
    async with httpx.AsyncClient() as client:
        for idx, machine in enumerate(machines):
            proxy_url = f"http://{machine.network_ip}:{PROXY_PORT}/v1/verify"
            response = await client.post(
                proxy_url,
                json={
                    "messages": [
                        {"role": msg.role, "content": msg.content}
                        for msg in req.messages
                    ],
                    "model": req.models[idx],
                },
            )
            response_data = response.json()
            results.append(
                {
                    "machine": machine.model_dump(),
                    "result": response_data["result"],
                    "response": response_data,
                }
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


@router.get("/v1/models", tags=["network"])
async def list_models(db: Session = Depends(get_session)) -> ModelListRes:
    supported_models = get_supported_models(db)
    return {
        "object": "list",
        "data": [
            {"id": model_id, "object": "model"}
            for model_id, _ in supported_models.items()
        ],
    }


@router.post("/v1/chat/completions")
async def generate(
    req: AiRequest,
    user: User = Depends(verify_user),
    db: Session = Depends(get_session),
) -> Response:
    timeStart = time.time()

    user_data = db.exec(select(UserModel).where(UserModel.user_id == user.id)).first()

    if not user_data:
        raise HTTPException(status_code=404, detail="User not found")

    if user_data.credits <= 0:
        raise HTTPException(status_code=402, detail="Insufficient credits")

    supported_models = get_supported_models(db)
    if req.model not in supported_models:
        raise HTTPException(status_code=400, detail="Unsupported model")

    model_config = supported_models[req.model]
    original_req_model = req.model
    req.model = model_config.id

    machine = get_random_machines(1)[0]
    proxy_url = f"http://{machine.network_ip}:{PROXY_PORT}/v1/chat/completions"
    llmres = requests.post(
        proxy_url,
        json=req.model_dump(),
        stream=req.stream,
        headers={"Accept-Encoding": "identity"},
    )

    def generate():
        usage = {}
        result_text = ""

        # Time to first token
        ttfs: Optional[float] = None

        for line in llmres.iter_lines():
            l = line.decode("utf-8")
            if l.startswith("data: "):
                l = l[6:]
            try:
                json_line = json.loads(l)
                if "choices" in json_line:
                    choice = json_line["choices"][0]
                    if "delta" in choice:
                        delta = choice["delta"]
                        if "content" in delta:
                            result_text += delta["content"]
                if "usage" in json_line:
                    usage = json_line["usage"]
            except json.JSONDecodeError as e:
                # print(e)
                pass

            if ttfs is None:
                ttfs = time.time() - timeStart
            yield line

        sm = get_setting_value(
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
            machine_id=machine.machine_uid,
        )

        db.add(api_log)

        # Calculate cost and reduce user credits
        prompt_tokens = usage.get("prompt_tokens", 0)
        completion_tokens = usage.get("completion_tokens", 0)
        total_tokens = usage.get("total_tokens", 0)

        prompt_tokens_cost = prompt_tokens * model_p.prompt_token
        completion_tokens_cost = completion_tokens * model_p.completion_token

        cost = prompt_tokens_cost + completion_tokens_cost

        user_data.credits -= cost
        user_data.updated_at = datetime.utcnow()

        # Update user credit history
        user_credits_history = UserCreditsHistory(
            user_id=user.id,
            amount=-cost,
            description=f"Used {total_tokens} tokens. Prompt tokens: {prompt_tokens}, Completion tokens: {completion_tokens}",
        )
        db.add(user_credits_history)

        db.commit()

    if req.stream:
        res = StreamingResponse(generate(), media_type="text/event-stream")
    else:
        return Response(
            content=llmres.text,
            status_code=llmres.status_code,
            headers=dict(llmres.headers),
        )

    return res
