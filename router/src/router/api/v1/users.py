from fastapi import APIRouter, Depends
from src.router.utils.user import get_user_credits
from src.router.core.types import User
from src.router.db.session import DBSession
from src.router.core.security import verify_token
from src.router.utils.nr import track

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
async def get_current_user(db: DBSession, user: User = Depends(verify_token)):
    user_credits = await get_user_credits(user.id, db)
    data = user.model_dump()
    data["credits"] = user_credits
    return data
