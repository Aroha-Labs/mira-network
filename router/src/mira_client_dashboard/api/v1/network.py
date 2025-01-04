from fastapi import APIRouter, Depends, Response, HTTPException
from sqlmodel import Session, select
from src.mira_client_dashboard.models.logs import ApiLogs
from src.mira_client_dashboard.db.session import get_session
from src.mira_client_dashboard.core.security import verify_token
from src.mira_client_dashboard.utils.network import get_random_machines, PROXY_PORT
from src.mira_client_dashboard.models.credits import UserCredits, UserCreditsHistory
from src.mira_client_dashboard.schemas.ai import AiRequest, VerifyRequest
import requests
import time
import httpx
import os
import json

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


@router.get("/v1/models", tags=["network"])
async def list_models():
    file_path = os.path.join(
        os.path.dirname(__file__), "../../../../supported-models.json"
    )

    with open(file_path, "r") as f:
        supported_models: list[str] = json.load(f)

    return {
        "object": "list",
        "data": [{"id": model, "object": "model"} for model in supported_models],
    }


@router.post("/v1/chat/completions")
async def generate(
    req: AiRequest,
    user=Depends(verify_token),
    db: Session = Depends(get_session),
) -> Response:
    start_time = time.time()

    machine = get_random_machines(1)[0]
    proxy_url = f"http://{machine.network_ip}:{PROXY_PORT}/v1/chat/completions"

    response = requests.post(proxy_url, json=req.model_dump())

    end_time = time.time()
    total_response_time = end_time - start_time

    # Calculate tokens
    total_tokens = 30  # Default value
    prompt_tokens = 10
    completion_tokens = 20

    # Log the API call
    api_log = ApiLogs(
        user_id=user.id,
        payload=str(req.model_dump()),
        response=response.text,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        total_tokens=total_tokens,
        total_response_time=total_response_time,
        model=req.model,
    )
    db.add(api_log)

    # Update user credits
    cost = total_tokens * 0.0003
    user_credits = db.exec(
        select(UserCredits).where(UserCredits.user_id == user.id)
    ).first()

    if user_credits:
        user_credits.credits -= cost
        db.add(user_credits)

        # Update user credit history
        user_credits_history = UserCreditsHistory(
            user_id=user.id,
            amount=-cost,
            description=f"Used {total_tokens} tokens",
        )
        db.add(user_credits_history)

    db.commit()

    return Response(
        content=response.text,
        status_code=response.status_code,
        headers=dict(response.headers),
    )
