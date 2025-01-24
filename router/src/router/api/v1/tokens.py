from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from src.router.core.types import User
from src.router.models.tokens import ApiToken
from src.router.schemas.tokens import ApiTokenRequest
from src.router.db.session import get_session
from src.router.core.security import verify_user
from datetime import datetime
import os

router = APIRouter()


@router.post(
    "/api-tokens",
    summary="Create API Token",
    description="""Creates a new API token for the authenticated user

### Authentication
- Requires a valid authentication token
- Token must be passed in the Authorization header

### Request Body
```json
{
    "description": string | null  // Optional description for the token
}
```

### Response Format
```json
{
    "id": int,              // Unique identifier for the token
    "token": string,        // The generated API token
    "description": string | null,
    "created_at": string    // ISO 8601 datetime
}
```

### Token Format
- Prefix: `sk-mira-`
- Length: 56 characters (including prefix)
- Example: `sk-mira-a1b2c3d4e5f6...`

### Error Responses
- `401 Unauthorized`:
    ```json
    {
        "detail": "Could not validate credentials"
    }
    ```
- `500 Internal Server Error`:
    ```json
    {
        "detail": "Error message from the server"
    }
    ```

### Notes
- Tokens are generated using cryptographically secure random bytes
- Tokens cannot be retrieved after creation - store them securely
- Multiple tokens per user are allowed
- Description field is optional but recommended for token management""",
    response_description="Returns the created API token details",
    responses={
        200: {
            "description": "Successfully created API token",
            "content": {
                "application/json": {
                    "example": {
                        "id": 1,
                        "token": "sk-mira-a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
                        "description": "Development environment token",
                        "created_at": "2024-01-15T10:30:00Z"
                    }
                }
            }
        },
        401: {
            "description": "Unauthorized - Invalid or missing authentication",
            "content": {
                "application/json": {
                    "example": {
                        "detail": "Could not validate credentials"
                    }
                }
            }
        },
        500: {
            "description": "Internal server error while creating token",
            "content": {
                "application/json": {
                    "example": {
                        "detail": "Database error occurred while creating token"
                    }
                }
            }
        }
    }
)
def create_api_token(
    request: ApiTokenRequest,
    db: Session = Depends(get_session),
    user: User = Depends(verify_user),
):
    token = f"sk-mira-{os.urandom(24).hex()}"
    try:
        api_token = ApiToken(
            user_id=user.id,
            token=token,
            description=request.description,
        )
        db.add(api_token)
        db.commit()
        db.refresh(api_token)
    except Exception as e:
        db.rollback()
        print(e)
        raise HTTPException(status_code=500, detail=str(e))
    return {
        "id": api_token.id,
        "token": api_token.token,
        "description": api_token.description,
        "created_at": api_token.created_at,
    }


@router.get(
    "/api-tokens",
    summary="List API Tokens",
    description="""Retrieves all active API tokens for the authenticated user.

### Authentication
- Requires a valid authentication token
- Token must be passed in the Authorization header

### Response Format
```json
[
    {
        "id": int,              // Unique identifier for the token
        "token": string,        // The API token
        "description": string | null,
        "created_at": string    // ISO 8601 datetime
    }
]
```

### Error Responses
- `401 Unauthorized`:
    ```json
    {
        "detail": "Could not validate credentials"
    }
    ```

### Notes
- Only returns active (non-deleted) tokens
- Tokens are ordered by creation date (newest first)
- Deleted tokens are not included in the response
- Empty array is returned if user has no active tokens""",
    response_description="Returns an array of active API token details",
    responses={
        200: {
            "description": "Successfully retrieved API tokens",
            "content": {
                "application/json": {
                    "example": [
                        {
                            "id": 1,
                            "token": "sk-mira-a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
                            "description": "Production token",
                            "created_at": "2024-01-15T10:30:00Z"
                        },
                        {
                            "id": 2,
                            "token": "sk-mira-b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7",
                            "description": "Development token",
                            "created_at": "2024-01-14T15:45:00Z"
                        }
                    ]
                }
            }
        },
        401: {
            "description": "Unauthorized - Invalid or missing authentication",
            "content": {
                "application/json": {
                    "example": {
                        "detail": "Could not validate credentials"
                    }
                }
            }
        }
    }
)
def list_api_tokens(
    db: Session = Depends(get_session), user: User = Depends(verify_user)
):
    tokens = (
        db.query(ApiToken)
        .filter(ApiToken.user_id == user.id, ApiToken.deleted_at.is_(None))
        .all()
    )
    return [
        {
            "id": token.id,
            "token": token.token,
            "description": token.description,
            "created_at": token.created_at,
        }
        for token in tokens
    ]


@router.delete(
    "/api-tokens/{token}",
    summary="Delete API Token",
    description="""Soft deletes an API token by setting its deleted_at timestamp.

### Authentication
- Requires a valid authentication token
- Token must be passed in the Authorization header

### Path Parameters
- `token`: The API token to delete (including 'sk-mira-' prefix)

### Response Format
```json
{
    "message": "Token deleted successfully"
}
```

### Error Responses
- `401 Unauthorized`:
    ```json
    {
        "detail": "Could not validate credentials"
    }
    ```
- `404 Not Found`:
    ```json
    {
        "detail": "Token not found"
    }
    ```

### Notes
- Performs a soft delete (sets deleted_at timestamp)
- Only the token owner can delete their tokens
- Token cannot be reactivated after deletion
- Deleted tokens will not work for API authentication""",
    response_description="Returns success message upon deletion",
    responses={
        200: {
            "description": "Successfully deleted API token",
            "content": {
                "application/json": {
                    "example": {
                        "message": "Token deleted successfully"
                    }
                }
            }
        },
        401: {
            "description": "Unauthorized - Invalid or missing authentication",
            "content": {
                "application/json": {
                    "example": {
                        "detail": "Could not validate credentials"
                    }
                }
            }
        },
        404: {
            "description": "Token not found",
            "content": {
                "application/json": {
                    "example": {
                        "detail": "Token not found"
                    }
                }
            }
        }
    }
)
def delete_api_token(
    token: str, db: Session = Depends(get_session), user: User = Depends(verify_user)
):
    api_token = (
        db.query(ApiToken)
        .filter(ApiToken.token == token, ApiToken.user_id == user.id)
        .first()
    )
    if not api_token:
        raise HTTPException(status_code=404, detail="Token not found")

    api_token.deleted_at = datetime.utcnow()
    db.commit()
    db.refresh(api_token)
    return {"message": "Token deleted successfully"}
