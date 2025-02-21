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
    Retrieves details of the currently authenticated user based on their JWT token.
    
    This endpoint:
    - Validates the user's JWT token
    - Queries the database for the user's full profile
    - Returns complete user information if found
    - Returns null if the user exists in JWT but not in database
    
    Authentication:
    - Requires a valid JWT token in the Authorization header
    - Format: Bearer <token>
    
    Rate Limits:
    - Standard API rate limits apply
    
    Notes:
    - Use this endpoint to get the current user's profile after login
    - Can be used to verify if a token is still valid
    """,
    response_description="Returns the complete user profile object or null if not found",
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
    db: Session = Depends(get_session), user: User = Depends(verify_token)
) -> UserModel | None:
    """
    Retrieve the current authenticated user's details from the database.

    Args:
        db (Session): Database session dependency
        user (User): Current authenticated user from JWT token

    Returns:
        UserModel | None: Complete user profile if found, None if not found

    Raises:
        HTTPException: 401 if authentication fails

    Notes:
        - This function assumes the user has already been authenticated via JWT
        - The user parameter comes from the verify_token dependency
        - Returns None instead of raising an error if the user is not found
    """
    user_data = db.exec(select(UserModel).where(UserModel.user_id == user.id)).first()
    if not user_data:
        return None
    return user_data
