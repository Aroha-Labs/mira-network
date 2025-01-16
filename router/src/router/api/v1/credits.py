from fastapi import APIRouter, Depends
from sqlmodel import Session, select
from src.router.core.types import User
from src.router.models.user import User as UserModel, UserCreditsHistory
from src.router.db.session import get_session
from src.router.core.security import verify_user

router = APIRouter()


@router.get("/user-credits")
def get_user_credits(
    db: Session = Depends(get_session), user: User = Depends(verify_user)
):
    user_data = db.exec(select(UserModel).where(UserModel.user_id == user.id)).first()
    return {"credits": user_data.credits if user_data else 0}


@router.get("/user-credits-history")
def get_user_credits_history(
    db: Session = Depends(get_session), user: User = Depends(verify_user)
):
    history = db.exec(
        select(UserCreditsHistory)
        .where(UserCreditsHistory.user_id == user.id)
        .order_by(UserCreditsHistory.created_at.desc())
    ).all()
    return history
