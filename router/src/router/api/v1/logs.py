from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from src.router.core.types import User
from src.router.models.logs import ApiLogs
from src.router.db.session import get_session
from src.router.core.security import verify_user
from sqlalchemy import func

router = APIRouter()


@router.get("/api-logs")
def list_all_logs(
    db: Session = Depends(get_session),
    user: User = Depends(verify_user),
    page: int = 1,
    page_size: int = 10,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    machine_id: Optional[str] = None,
    model: Optional[str] = None,
    api_key_id: Optional[int] = None,
    order_by: Optional[str] = "created_at",
    order: Optional[str] = "desc",
):
    offset = (page - 1) * page_size
    query = db.query(ApiLogs).filter(ApiLogs.user_id == user.id)

    if start_date:
        query = query.filter(ApiLogs.created_at >= start_date)
    if end_date:
        query = query.filter(ApiLogs.created_at <= end_date)
    if machine_id:
        query = query.filter(ApiLogs.machine_id == machine_id)
    if model:
        query = query.filter(ApiLogs.model == model)
    if api_key_id:
        query = query.filter(ApiLogs.api_key_id == api_key_id)

    if order_by not in ["created_at", "total_response_time", "total_tokens"]:
        raise HTTPException(status_code=400, detail="Invalid order_by field")
    if order == "desc":
        query = query.order_by(getattr(ApiLogs, order_by).desc())
    elif order == "asc":
        query = query.order_by(getattr(ApiLogs, order_by).asc())
    else:
        raise HTTPException(status_code=400, detail="Invalid order direction")
    logs = query.offset(offset).limit(page_size).all()
    total_logs = query.count()

    def exclude_model_from_pricing(log):
        l = log.dict()
        model_pricing = l.get("model_pricing")

        if model_pricing is None:
            return l

        if model_pricing.get("model") is not None:
            model_pricing.pop("model")

        l["model_pricing"] = model_pricing
        return l

    filtered_logs = list(map(exclude_model_from_pricing, logs))

    return {
        "logs": filtered_logs,
        "total": total_logs,
        "page": page,
        "page_size": page_size,
    }


@router.get("/total-inference-calls")
def total_inference_calls(
    db: Session = Depends(get_session),
    user: User = Depends(verify_user),
):
    total = db.exec(
        select(func.count()).select_from(ApiLogs).where(ApiLogs.user_id == user.id)
    ).first()
    return total
