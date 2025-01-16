from fastapi import APIRouter, Depends
from sqlmodel import Session, select
from src.router.core.types import User
from src.router.models.user import User as UserModel
from src.router.db.session import get_session
from src.router.core.security import verify_token

router = APIRouter()


@router.get("/me")
def get_current_user(
    db: Session = Depends(get_session), user: User = Depends(verify_token)
):
    """Get current logged-in user details"""
    user_data = db.exec(select(UserModel).where(UserModel.user_id == user.id)).first()
    if not user_data:
        return None
    return user_data
