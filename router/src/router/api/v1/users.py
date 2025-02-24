from fastapi import APIRouter, Depends
from sqlmodel import select
from src.router.core.types import User
from src.router.models.user import User as UserModel
from src.router.db.session import DBSession
from src.router.core.security import verify_token
from src.router.utils.redis import redis_client  # new import for redis

router = APIRouter()


@router.get(
    "/me",
    summary="Get Current User",
    description="Retrieves the authenticated user's profile along with the updated credits.",
    response_description="Returns the complete user profile object including credits",
    responses={
        200: {
            "description": "Successfully retrieved user details",
            "content": {
                "application/json": {
                    "examples": {
                        "success": {
                            "summary": "User Found",
                            "value": {
                                "user_id": "123e4567-e89b-12d3-a456-426614174000",
                                "email": "user@example.com",
                                "name": "John Doe",
                                "credits": 50,
                                "created_at": "2024-01-01T00:00:00Z",
                                "updated_at": "2024-01-01T00:00:00Z",
                            },
                        },
                        "not_found": {"summary": "User Not Found", "value": None},
                    }
                }
            },
        },
        401: {
            "description": "Unauthorized - Invalid or missing authentication token",
            "content": {
                "application/json": {
                    "example": {"detail": "Could not validate credentials"}
                }
            },
        },
    },
)
async def get_current_user(
    db: DBSession,
    user: User = Depends(verify_token),
) -> dict | None:
    # Retrieve user data from the DB
    user_data = await db.exec(select(UserModel).where(UserModel.user_id == user.id))
    user_data = user_data.first()
    if not user_data:
        return None

    # Get updated credits from Redis; fallback to DB value if missing
    redis_key = f"user_credit:{user.id}"
    credit = await redis_client.get(redis_key)
    if credit is None:
        credit = user_data.credits
    else:
        credit = float(credit)

    data = user_data.model_dump()
    data["credits"] = credit
    return data
