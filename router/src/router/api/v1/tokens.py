import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import func, select
from src.router.core.types import User
from src.router.models.tokens import ApiToken
from src.router.schemas.tokens import ApiTokenRequest
from src.router.db.session import DBSession
from src.router.core.security import verify_user
from datetime import datetime
import os
from src.router.utils.redis import redis_client

logger = logging.getLogger(__name__)

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
    "description": string | null,  // Optional description for the token
    "meta_data": object | null     // Optional metadata for the token
}
```

### Response Format
```json
{
    "id": int,              // Unique identifier for the token
    "token": string,        // The generated API token
    "description": string | null,
    "meta_data": object,    // Metadata associated with the token
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
                        "meta_data": {"env": "development"},
                        "created_at": "2024-01-15T10:30:00Z",
                    }
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
        500: {
            "description": "Internal server error while creating token",
            "content": {
                "application/json": {
                    "example": {
                        "detail": "Database error occurred while creating token"
                    }
                }
            },
        },
    },
)
async def create_api_token(
    request: ApiTokenRequest,
    db: DBSession,
    user: User = Depends(verify_user),
):
    token = f"sk-mira-{os.urandom(24).hex()}"
    try:
        api_token = ApiToken(
            user_id=user.id,
            token=token,
            description=request.description,
            meta_data=request.meta_data,
        )
        db.add(api_token)
        await db.commit()
        await db.refresh(api_token)

        return {
            "id": api_token.id,
            "token": api_token.token,
            "description": api_token.description,
            "meta_data": api_token.meta_data,
            "created_at": api_token.created_at,
        }
    except Exception as e:
        await db.rollback()
        logger.error(f"Error creating API token: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to create API token")


@router.get(
    "/api-tokens",
    summary="List API Tokens",
    description="""Retrieves all active API tokens for the authenticated user.

### Authentication
- Requires a valid authentication token
- Token must be passed in the Authorization header

### Query Parameters
- `page`: Page number (optional, default: 1)
- `page_size`: Number of items per page (optional, default: 100)

### Response Format
```json
{
    "items": [
        {
            "id": int,              // Unique identifier for the token
            "token": string,        // The API token
            "description": string | null,
            "meta_data": object,    // Metadata associated with the token
            "created_at": string    // ISO 8601 datetime
        }
    ],
    "total": int,          // Total number of tokens
    "page": int,           // Current page number
    "page_size": int,      // Items per page
    "total_pages": int     // Total number of pages
}
```

### Notes
- Only returns active (non-deleted) tokens
- Tokens are ordered by creation date (newest first)
- For backward compatibility, if no pagination parameters are provided, 
  returns all tokens in a flat array
- Default page_size is 100 items""",
    response_description="Returns paginated API token details",
)
async def list_api_tokens(
    db: DBSession,
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(10, ge=1, le=100, description="Items per page"),
    user: User = Depends(verify_user),
):
    query = (
        select(ApiToken)
        .where(ApiToken.user_id == user.id)
        .where(ApiToken.deleted_at == None)  # noqa: E711
    )
    count_query = (
        select(func.count())
        .select_from(ApiToken)
        .where(ApiToken.user_id == user.id)
        .where(ApiToken.deleted_at == None)  # noqa: E711
    )

    total_res = await db.exec(count_query)
    total = total_res.one()
    total_pages = total + page_size - 1

    # Apply pagination
    tokens_res = await db.exec(query.offset((page - 1) * page_size).limit(page_size))
    tokens = tokens_res.all()

    return {
        "items": [
            {
                "id": token.id,
                "token": token.token,
                "description": token.description,
                "meta_data": token.meta_data,
                "created_at": token.created_at,
            }
            for token in tokens
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
    }


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
                    "example": {"message": "Token deleted successfully"}
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
        404: {
            "description": "Token not found",
            "content": {"application/json": {"example": {"detail": "Token not found"}}},
        },
    },
)
async def delete_api_token(
    token: str,
    db: DBSession,
    user: User = Depends(verify_user),
):
    api_token_res = await db.exec(
        select(ApiToken)
        .where(ApiToken.token == token)
        .where(ApiToken.user_id == user.id)
    )

    api_token = api_token_res.one_or_none()

    if not api_token:
        raise HTTPException(status_code=404, detail="Token not found")

    api_token.deleted_at = datetime.utcnow()
    await db.commit()
    await db.refresh(api_token)

    # Invalidate the cache
    try:
        await redis_client.delete(f"token:{token}")
    except Exception as e:
        logger.error(f"Error invalidating token cache: {e}")

    return {"message": "Token deleted successfully"}
