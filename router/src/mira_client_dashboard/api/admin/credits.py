from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from src.mira_client_dashboard.models.credits import UserCredits
from src.mira_client_dashboard.db.session import get_session
from src.mira_client_dashboard.core.security import verify_token

router = APIRouter()


@router.get("/user-credits/{user_id}")
def get_user_credits_by_id(
    user_id: str, db: Session = Depends(get_session), user=Depends(verify_token)
):
    user_credits = db.exec(
        select(UserCredits).where(UserCredits.user_id == user_id)
    ).first()
    if not user_credits:
        return {"credits": 0}
    return {"credits": user_credits.credits}
