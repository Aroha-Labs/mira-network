import logging
from typing import Optional, Literal
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import select
from src.router.core.types import User
from src.router.models.logs import ApiLogs
from src.router.db.session import DBSession
from src.router.core.security import verify_user
from sqlalchemy import func, desc, asc
from sqlalchemy.types import Float
from datetime import datetime, timedelta

router = APIRouter()


@router.get(
    "/api-logs",
    summary="List API Logs",
    description="""Retrieves paginated API logs for the authenticated user.

### Authentication
- Requires a valid authentication token
- Token must be passed in the Authorization header

### Query Parameters
- `page`: Page number (default: 1)
- `page_size`: Number of items per page (default: 10)
- `start_date`: Filter logs after this date (ISO 8601 format)
- `end_date`: Filter logs before this date (ISO 8601 format)
- `machine_id`: Filter logs by machine ID
- `model`: Filter logs by AI model name
- `api_key_id`: Filter logs by API key ID
- `user_id`: Filter logs by user ID (admin only)
- `order_by`: Sort field (default: "created_at")
- `order`: Sort direction ("asc" or "desc", default: "desc")

### Supported Order By Fields
- `created_at`: Timestamp of the log entry
- `total_response_time`: Total API response time
- `total_tokens`: Total tokens used
- `prompt_tokens`: Prompt tokens used
- `completion_tokens`: Completion tokens used
- `ttft`: Time to first token
- `model`: AI model name
- `machine_id`: Machine identifier

### Response Format
```json
{
    "logs": [
        {
            "id": int,
            "user_id": string,
            "api_key_id": int | null,
            "payload": string | null,
            "request_payload": object | null,
            "ttft": float | null,
            "response": string,
            "prompt_tokens": int,
            "completion_tokens": int,
            "total_tokens": int,
            "total_response_time": float,
            "model": string,
            "model_pricing": {
                "prompt_token": float,
                "completion_token": float
            },
            "machine_id": string | null,
            "created_at": string (ISO 8601 datetime)
        }
    ],
    "total": int,
    "page": int,
    "page_size": int
}
```

### Error Responses
- `400 Bad Request`:
    ```json
    {
        "detail": "Invalid order_by field"
    }
    ```
- `401 Unauthorized`:
    ```json
    {
        "detail": "Could not validate credentials"
    }
    ```
- `403 Forbidden`:
    ```json
    {
        "detail": "Only admins can query other users' logs"
    }
    ```

### Notes
- Response is paginated
- Dates should be provided in ISO 8601 format
- Admin users can query logs for any user using the user_id parameter
- Non-admin users can only access their own logs
- model_pricing.model field is excluded from the response""",
    response_description="Returns a paginated list of API logs with total count",
    responses={
        200: {
            "description": "Successfully retrieved logs",
            "content": {
                "application/json": {
                    "example": {
                        "logs": [
                            {
                                "id": 1,
                                "user_id": "user_123",
                                "api_key_id": 1,
                                "payload": "What is the weather?",
                                "request_payload": {
                                    "model": "gpt-4",
                                    "messages": [
                                        {
                                            "role": "user",
                                            "content": "What is the weather?",
                                        }
                                    ],
                                },
                                "ttft": 0.15,
                                "response": "I cannot provide real-time weather information.",
                                "prompt_tokens": 10,
                                "completion_tokens": 15,
                                "total_tokens": 25,
                                "total_response_time": 1.2,
                                "model": "gpt-4",
                                "model_pricing": {
                                    "prompt_token": 0.00001,
                                    "completion_token": 0.00002,
                                },
                                "machine_id": "machine_abc",
                                "created_at": "2024-01-15T10:30:00Z",
                            }
                        ],
                        "total": 150,
                        "page": 1,
                        "page_size": 10,
                    }
                }
            },
        },
        400: {
            "description": "Bad Request - Invalid parameters",
            "content": {
                "application/json": {"example": {"detail": "Invalid order_by field"}}
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
        403: {
            "description": "Forbidden - Non-admin trying to access other user's logs",
            "content": {
                "application/json": {
                    "example": {"detail": "Only admins can query other users' logs"}
                }
            },
        },
    },
)
async def list_all_logs(
    db: DBSession,
    user: User = Depends(verify_user),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    start_date: Optional[datetime] = Query(default=None),
    end_date: Optional[datetime] = Query(default=None),
    machine_id: Optional[str] = Query(default=None),
    model: Optional[str] = Query(default=None),
    api_key_id: Optional[int] = Query(default=None),
    user_id: Optional[str] = Query(default=None),
    order_by: Literal["created_at", "model", "machine_id"] = Query(
        default="created_at"
    ),
    order: Literal["asc", "desc"] = Query(default="desc"),
    flow_id: Optional[str] = Query(default=None),
):
    """
    List all logs with proper type validation

    Args:
        page: Page number (starts at 1)
        page_size: Number of items per page (1-100)
        start_date: Filter logs after this date (ISO format)
        end_date: Filter logs before this date (ISO format)
        machine_id: Filter by machine ID
        model: Filter by model name
        api_key_id: Filter by API key ID
        user_id: Filter by user ID
        order_by: Field to sort by
        order: Sort order (asc/desc)
        flow_id: Filter by flow ID
    """
    try:
        # Validate dates if provided
        if isinstance(start_date, str):
            start_date = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
        if isinstance(end_date, str):
            end_date = datetime.fromisoformat(end_date.replace("Z", "+00:00"))

        # Ensure api_key_id is integer
        if api_key_id is not None:
            api_key_id = int(api_key_id)

        # Build query with proper types
        query = select(ApiLogs)

        if start_date:
            query = query.where(ApiLogs.created_at >= start_date)
        if end_date:
            query = query.where(ApiLogs.created_at <= end_date)
        if machine_id:
            query = query.where(ApiLogs.machine_id == str(machine_id))
        if model:
            query = query.where(ApiLogs.model == str(model))
        if api_key_id:
            query = query.where(ApiLogs.api_key_id == int(api_key_id))
        if user_id:
            query = query.where(ApiLogs.user_id == str(user_id))
        if flow_id:
            query = query.where(ApiLogs.flow_id == str(flow_id))

        # Validate order_by field
        valid_order_fields = ["created_at", "model", "machine_id"]
        if order_by not in valid_order_fields:
            order_by = "created_at"

        # Apply ordering
        order_column = getattr(ApiLogs, order_by)
        query = query.order_by(
            desc(order_column) if order.lower() == "desc" else asc(order_column)
        )

        # Apply pagination
        query = query.offset((page - 1) * page_size).limit(page_size)

        result = await db.exec(query)
        logs = result.all()

        return {"page": page, "page_size": page_size, "logs": logs}

    except ValueError as e:
        raise HTTPException(
            status_code=400, detail=f"Invalid parameter value: {str(e)}"
        )
    except Exception as e:
        logger.error(f"Error in list_all_logs: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get(
    "/total-inference-calls",
    summary="Get Total Inference Calls",
    description="""Retrieves the total count of inference API calls made by the authenticated user.

### Authentication
- Requires a valid authentication token
- Token must be passed in the Authorization header

### Response Format
```json
{
    "total": int  // Total number of API calls made
}
```

### Error Responses
- `401 Unauthorized`:
    ```json
    {
        "detail": "Could not validate credentials"
    }
    ```

### Notes
- Counts all API calls regardless of success or failure
- Includes calls made with all API keys owned by the user
- Historical calls are included (no date filtering)""",
    response_description="Returns the total count of inference calls made by the user",
    responses={
        200: {
            "description": "Successfully retrieved total count",
            "content": {"application/json": {"example": {"total": 1500}}},
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
async def total_inference_calls(db: DBSession, user: User = Depends(verify_user)):
    total = await db.exec(
        select(func.count()).select_from(ApiLogs).where(ApiLogs.user_id == user.id)
    )
    return {"total": total.first()}


@router.get("/api-logs/metrics")
async def get_logs_metrics(
    db: DBSession,
    user: User = Depends(verify_user),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    machine_id: Optional[int] = None,  # Type hint remains int
    model: Optional[str] = None,
    api_key_id: Optional[int] = None,
    user_id: Optional[str] = None,
    flow_id: Optional[str] = None,
    time_bucket: str = "hour",  # hour, day, week, month
):
    """Get aggregated metrics without raw logs"""

    # Get time bucket function
    time_bucket_fn = {
        "hour": lambda x: func.date_trunc("hour", x),
        "day": lambda x: func.date_trunc("day", x),
        "week": lambda x: func.date_trunc("week", x),
        "month": lambda x: func.date_trunc("month", x),
    }[time_bucket]

    # Get default time range based on bucket
    end_dt = datetime.fromisoformat(end_date) if end_date else datetime.utcnow()
    if not start_date:
        start_dt = end_dt - timedelta(
            days={
                "hour": 1,  # Last 24 hours
                "day": 7,  # Last week
                "week": 30,  # Last month
                "month": 365,  # Last year
            }[time_bucket]
        )
    else:
        start_dt = datetime.fromisoformat(start_date)

    # Build query with time bucket and date filtering
    time_bucket_col = time_bucket_fn(ApiLogs.created_at).label("timestamp")

    query = select(
        time_bucket_col,
        ApiLogs.model,
        func.count().label("calls"),
        func.coalesce(func.sum(ApiLogs.prompt_tokens), 0).label("prompt_tokens"),
        func.coalesce(func.sum(ApiLogs.completion_tokens), 0).label(
            "completion_tokens"
        ),
        func.coalesce(func.avg(ApiLogs.total_response_time), 0.0).label(
            "avg_response_time"
        ),
        func.coalesce(func.avg(ApiLogs.ttft), 0.0).label("avg_ttft"),
        func.coalesce(
            func.sum(
                ApiLogs.prompt_tokens
                * func.cast(ApiLogs.model_pricing["prompt_token"].astext, Float)
            ),
            0.0,
        ).label("prompt_cost"),
        func.coalesce(
            func.sum(
                ApiLogs.completion_tokens
                * func.cast(ApiLogs.model_pricing["completion_token"].astext, Float)
            ),
            0.0,
        ).label("completion_cost"),
    ).where(ApiLogs.created_at.between(start_dt, end_dt))

    # Access control
    if user_id:
        if "admin" not in user.roles:
            raise HTTPException(
                status_code=403, detail="Only admins can query other users' logs"
            )
        query = query.where(ApiLogs.user_id == user_id)
    else:
        if "admin" not in user.roles:
            query = query.where(ApiLogs.user_id == user.id)

    # Apply filters
    if start_date:
        query = query.where(ApiLogs.created_at >= start_date)
    if end_date:
        query = query.where(ApiLogs.created_at <= end_date)
    if machine_id:
        query = query.where(ApiLogs.machine_id == str(machine_id))  # Convert to string
    if model:
        query = query.where(ApiLogs.model == model)
    if api_key_id:
        query = query.where(ApiLogs.api_key_id == api_key_id)
    if flow_id:
        query = query.where(ApiLogs.flow_id == flow_id)

    # Group by timestamp and model, use the time_bucket_col directly
    query = query.group_by(time_bucket_col, ApiLogs.model).order_by(time_bucket_col)

    # Rest of the function remains the same
    results = await db.exec(query)
    results = results.all()

    # Process results safely
    time_series = {}
    model_distribution = {}

    for row in results:
        timestamp = row.timestamp.isoformat()
        if timestamp not in time_series:
            time_series[timestamp] = {
                "timestamp": timestamp,
                "calls": 0,
                "prompt_tokens": 0,
                "completion_tokens": 0,
                "avg_response_time": 0.0,
                "avg_ttft": 0.0,
                "prompt_cost": 0.0,
                "completion_cost": 0.0,
            }

        time_series[timestamp]["calls"] += row.calls or 0
        time_series[timestamp]["prompt_tokens"] += row.prompt_tokens or 0
        time_series[timestamp]["completion_tokens"] += row.completion_tokens or 0
        time_series[timestamp]["avg_response_time"] = row.avg_response_time or 0.0
        time_series[timestamp]["avg_ttft"] = row.avg_ttft or 0.0
        time_series[timestamp]["prompt_cost"] += row.prompt_cost or 0.0
        time_series[timestamp]["completion_cost"] += row.completion_cost or 0.0

        if row.model not in model_distribution:
            model_distribution[row.model] = {
                "model": row.model,
                "count": row.calls or 0,
            }

    # Safe summary calculations
    total_calls = sum(ts["calls"] for ts in time_series.values())

    return {
        "summary": {
            "total_calls": total_calls,
            "total_tokens": sum(
                (ts["prompt_tokens"] or 0) + (ts["completion_tokens"] or 0)
                for ts in time_series.values()
            ),
            "avg_response_time": (
                sum(
                    (ts["avg_response_time"] or 0.0) * ts["calls"]
                    for ts in time_series.values()
                )
                / total_calls
                if total_calls > 0
                else 0.0
            ),
            "avg_ttft": (
                sum(
                    (ts["avg_ttft"] or 0.0) * ts["calls"] for ts in time_series.values()
                )
                / total_calls
                if total_calls > 0
                else 0.0
            ),
            "total_cost": sum(
                (ts["prompt_cost"] or 0.0) + (ts["completion_cost"] or 0.0)
                for ts in time_series.values()
            ),
        },
        "time_series": list(time_series.values()),
        "model_distribution": list(model_distribution.values()),
    }
