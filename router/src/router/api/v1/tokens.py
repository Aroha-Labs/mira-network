from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session
from src.router.core.types import User
from src.router.models.tokens import ApiToken
from src.router.schemas.tokens import ApiTokenRequest
from src.router.db.session import get_session
from src.router.core.security import verify_user
from datetime import datetime
import os
from src.router.utils.nr import track

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
def create_api_token(
    request: ApiTokenRequest,
    db: Session = Depends(get_session),
    user: User = Depends(verify_user),
):
    track("create_api_token_request", {
        "user_id": str(user.id),
        "has_description": request.description is not None,
        "has_metadata": request.meta_data is not None
    })
    
    token = f"sk-mira-{os.urandom(24).hex()}"
    try:
        api_token = ApiToken(
            user_id=user.id,
            token=token,
            description=request.description,
            meta_data=request.meta_data,
        )
        db.add(api_token)
        db.commit()
        db.refresh(api_token)
        
        track("create_api_token_success", {
            "user_id": str(user.id),
            "token_id": api_token.id
        })
        
    except Exception as e:
        db.rollback()
        track("create_api_token_error", {
            "user_id": str(user.id),
            "error": str(e)
        })
        raise HTTPException(status_code=500, detail=str(e))
        
    return {
        "id": api_token.id,
        "token": api_token.token,
        "description": api_token.description,
        "meta_data": api_token.meta_data,
        "created_at": api_token.created_at,
    }


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
def list_api_tokens(
    page: int = Query(None, ge=1, description="Page number"),
    page_size: int = Query(None, ge=1, le=100, description="Items per page"),
    db: Session = Depends(get_session),
    user: User = Depends(verify_user),
):
    track("list_api_tokens_request", {
        "user_id": str(user.id),
        "page": page,
        "page_size": page_size,
        "use_pagination": page is not None and page_size is not None
    })
    
    query = (
        db.query(ApiToken)
        .filter(ApiToken.user_id == user.id, ApiToken.deleted_at.is_(None))
        .order_by(ApiToken.created_at.desc())
    )

    # If no pagination parameters, return all tokens (backward compatibility)
    if page is None and page_size is None:
        tokens = query.all()
        
        track("list_api_tokens_response", {
            "user_id": str(user.id),
            "tokens_count": len(tokens),
            "paginated": False
        })
        
        return [
            {
                "id": token.id,
                "token": token.token,
                "description": token.description,
                "meta_data": token.meta_data,
                "created_at": token.created_at,
            }
            for token in tokens
        ]

    # Default values for pagination
    page = page or 1
    page_size = page_size or 100

    # Get total count
    total = query.count()
    total_pages = (total + page_size - 1) // page_size

    # Apply pagination
    tokens = query.offset((page - 1) * page_size).limit(page_size).all()
    
    track("list_api_tokens_response", {
        "user_id": str(user.id),
        "tokens_count": len(tokens),
        "total_tokens": total,
        "page": page,
        "total_pages": total_pages,
        "paginated": True
    })

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
def delete_api_token(
    token: str,
    db: Session = Depends(get_session),
    user: User = Depends(verify_user),
):
    track("delete_api_token_request", {
        "user_id": str(user.id),
        "token_prefix": token[:12] if len(token) > 12 else token  # Just include prefix for safety
    })
    
    api_token = (
        db.query(ApiToken)
        .filter(ApiToken.token == token, ApiToken.user_id == user.id)
        .first()
    )
    if not api_token:
        track("delete_api_token_error", {
            "user_id": str(user.id),
            "error": "token_not_found"
        })
        raise HTTPException(status_code=404, detail="Token not found")

    api_token.deleted_at = datetime.utcnow()
    db.commit()
    db.refresh(api_token)
    
    track("delete_api_token_success", {
        "user_id": str(user.id),
        "token_id": api_token.id
    })
    
    return {"message": "Token deleted successfully"}
