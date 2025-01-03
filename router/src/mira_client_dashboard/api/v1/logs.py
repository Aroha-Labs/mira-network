from fastapi import APIRouter, Depends
from sqlmodel import Session, select
from src.mira_client_dashboard.models.logs import ApiLogs
from src.mira_client_dashboard.db.session import get_session
from src.mira_client_dashboard.core.security import verify_token
from sqlalchemy import func

router = APIRouter()

@router.get("/api-logs")
def get_api_logs(
    page: int = 1,
    page_size: int = 10,
    order_by: str = "created_at",
    order: str = "desc",
    db: Session = Depends(get_session),
    user=Depends(verify_token),
):
    query = select(ApiLogs).where(ApiLogs.user_id == user.id)

    if order == "desc":
        query = query.order_by(getattr(ApiLogs, order_by).desc())
    else:
        query = query.order_by(getattr(ApiLogs, order_by))

    total = db.exec(select(func.count()).select_from(query.subquery())).first()
    
    query = query.offset((page - 1) * page_size).limit(page_size)
    logs = db.exec(query).all()

    return {
        "logs": logs,
        "total": total,
        "page": page,
        "page_size": page_size,
    }

@router.get("/total-inference-calls")
def total_inference_calls(
    db: Session = Depends(get_session), user=Depends(verify_token)
):
    total = db.exec(
        select(func.count())
        .select_from(ApiLogs)
        .where(ApiLogs.user_id == user.id)
    ).first()
    return total