from fastapi import APIRouter, Depends, Query
from src.router.utils.user import get_user_credits
from src.router.models.user import User
from src.router.db.session import DBSession
from src.router.core.security import verify_user
from datetime import datetime
from src.router.utils.opensearch import opensearch_client, OPENSEARCH_CREDITS_INDEX

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
async def get_credit_balance(db: DBSession, user: User = Depends(verify_user)):
    user_credits = await get_user_credits(user.id, db)
    return {"credits": user_credits}


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
async def get_user_credits_history(
    user: User = Depends(verify_user),
    page: int = Query(default=1, ge=1, description="Page number"),
    size: int = Query(default=20, ge=1, le=100, description="Items per page"),
):
    start = (page - 1) * size

    query = {
        "query": {
            "bool": {
                "must": [
                    {"match": {"user_id": user.id}},
                    {"term": {"doc_type": "credit_history"}},
                ]
            }
        },
        "from": start,
        "size": size,
        "sort": [{"timestamp": {"order": "desc"}}],
        "track_total_hits": True,
    }

    response = opensearch_client.search(index=OPENSEARCH_CREDITS_INDEX, body=query)
    total = response["hits"]["total"]["value"]
    total_pages = (total + size - 1) // size

    history = []
    for hit in response["hits"]["hits"]:
        source = hit["_source"]
        history.append(
            {
                "id": hit["_id"],
                "user_id": source.get("user_id", ""),
                "amount": source.get("amount", None),
                "description": source.get("description", ""),
                "created_at": datetime.fromisoformat(
                    source["timestamp"].replace("Z", "+00:00")
                ),
            }
        )

    return {
        "items": history,
        "total": total,
        "page": page,
        "size": size,
        "pages": total_pages,
    }


@router.get(
    "/user-credits-stats",
    summary="Get User Credits Statistics",
    response_description="Returns the user's credit usage statistics",
)
async def get_user_credits_stats(user: User = Depends(verify_user)):
    query = {
        "query": {
            "bool": {
                "must": [
                    {"match": {"user_id": user.id}},
                    {"term": {"doc_type": "credit_history"}},
                ]
            }
        },
        "aggs": {
            "total_credits_added": {
                "sum": {
                    "script": {
                        "source": "doc['amount'].value > 0 ? doc['amount'].value : 0"
                    }
                }
            },
            "total_credits_used": {
                "sum": {
                    "script": {
                        "source": "doc['amount'].value < 0 ? Math.abs(doc['amount'].value) : 0"
                    }
                }
            },
        },
        "size": 0,
    }

    response = opensearch_client.search(index=OPENSEARCH_CREDITS_INDEX, body=query)
    aggs = response["aggregations"]

    return {
        "total_credits_added": aggs["total_credits_added"]["value"],
        "total_credits_used": aggs["total_credits_used"]["value"],
    }
