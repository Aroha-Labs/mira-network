from fastapi import APIRouter, Depends
from sqlmodel import Session, select
from src.router.core.types import User
from src.router.models.user import User as UserModel
from src.router.db.session import get_session
from src.router.core.security import verify_token

router = APIRouter()


@router.get(
    "/me",
    summary="Get Current User",
    description="""
    Retrieves details of the currently authenticated user.
    Returns user information from the database including ID and other profile details.
    Returns null if the user is not found in the database.
    """,
    response_description="Returns the user details or null",
    responses={
        200: {"description": "Successfully retrieved user details"},
        401: {"description": "Unauthorized - Invalid or missing authentication"},
    },
)
def get_current_user(
    db: Session = Depends(get_session), user: User = Depends(verify_token)
):
    """Get current logged-in user details"""
    user_data = db.exec(select(UserModel).where(UserModel.user_id == user.id)).first()
    if not user_data:
        return None
    return user_data
