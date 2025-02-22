from fastapi import APIRouter, Depends
from sqlmodel import select
from src.router.core.types import User
from src.router.models.user import User as UserModel, UserCreditsHistory
from src.router.db.session import DBSession
from src.router.core.security import verify_user

router = APIRouter()


@router.get(
    "/user-credits",
    summary="Get User Credits Balance",
    description="""Retrieves the current credit balance for the authenticated user.

### Authentication
- Requires a valid authentication token
- Token must be passed in the Authorization header

### Response Format
```json
{
    "credits": float  // Current credit balance
}
```

### Error Responses
- `401 Unauthorized`:
    ```json
    {
        "detail": "Invalid authentication credentials"
    }
    ```
- `401 Unauthorized`:
    ```json
    {
        "detail": "Could not validate credentials"
    }
    ```

### Notes
- Returns 0 if user has no credits entry in database
- Credit balance is stored as a float value
- Balance can be negative if user has overspent""",
    response_description="Returns the user's current credit balance as a float value",
    responses={
        200: {
            "description": "Successfully retrieved user credits",
            "content": {"application/json": {"example": {"credits": 150.75}}},
        },
        401: {
            "description": "Unauthorized - Invalid or missing authentication",
            "content": {
                "application/json": {
                    "example": {"detail": "Could not validate credentials"}
                }
            },
        },
    },
)
async def get_user_credits(db: DBSession, user: User = Depends(verify_user)):
    user_data = db.exec(select(UserModel).where(UserModel.user_id == user.id)).first()
    return {"credits": user_data.credits if user_data else 0}


@router.get(
    "/user-credits-history",
    summary="Get User Credits History",
    description="""Retrieves the complete history of credit transactions for the authenticated user, ordered by most recent first.

### Authentication
- Requires a valid authentication token
- Token must be passed in the Authorization header

### Response Format
```json
[
    {
        "id": int,
        "user_id": string,
        "amount": float,
        "description": string | null,
        "created_at": string (ISO 8601 datetime)
    }
]
```

### Fields Description
- `id`: Unique identifier for the transaction
- `user_id`: User's unique identifier
- `amount`: Transaction amount (positive for credits added, negative for credits used)
- `description`: Optional description of the transaction
- `created_at`: Timestamp of when the transaction occurred

### Error Responses
- `401 Unauthorized`:
    ```json
    {
        "detail": "Invalid authentication credentials"
    }
    ```
- `401 Unauthorized`:
    ```json
    {
        "detail": "Could not validate credentials"
    }
    ```

### Notes
- Results are ordered by created_at in descending order (newest first)
- Empty array is returned if user has no credit history
- Amount field can be positive (credit added) or negative (credit used)""",
    response_description="Returns a list of credit history entries ordered by most recent first",
    responses={
        200: {
            "description": "Successfully retrieved credit history",
            "content": {
                "application/json": {
                    "example": [
                        {
                            "id": 1,
                            "user_id": "user_123",
                            "amount": 100.0,
                            "description": "Initial credit deposit",
                            "created_at": "2024-01-15T10:30:00Z",
                        },
                        {
                            "id": 2,
                            "user_id": "user_123",
                            "amount": -25.5,
                            "description": "API usage charge",
                            "created_at": "2024-01-15T11:45:00Z",
                        },
                    ]
                }
            },
        },
        401: {
            "description": "Unauthorized - Invalid or missing authentication",
            "content": {
                "application/json": {
                    "example": {"detail": "Could not validate credentials"}
                }
            },
        },
    },
)
async def get_user_credits_history(db: DBSession, user: User = Depends(verify_user)):
    history = await db.exec(
        select(UserCreditsHistory)
        .where(UserCreditsHistory.user_id == user.id)
        .order_by(UserCreditsHistory.created_at.desc())
    )
    return history.all()
