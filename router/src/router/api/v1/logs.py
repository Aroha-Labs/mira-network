from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from src.router.core.types import User
from src.router.models.logs import ApiLogs
from src.router.db.session import get_session
from src.router.core.security import verify_user
from sqlalchemy import func
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
    db: Session = Depends(get_session),
    user: User = Depends(verify_user),
    page: int = 1,
    page_size: int = 10,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    machine_id: Optional[str] = None,
    model: Optional[str] = None,
    api_key_id: Optional[int] = None,
    user_id: Optional[str] = None,
    order_by: Optional[str] = "created_at",
    order: Optional[str] = "desc",
    flow_id: Optional[str] = None,
):
    # Check admin access
    if user_id:
        if "admin" not in user.roles:
            raise HTTPException(
                status_code=403, detail="Only admins can query other users' logs"
            )

    offset = (page - 1) * page_size

    query = db.query(ApiLogs)

    # Handle user_id filtering and admin access
    if "admin" in user.roles:
        # Start with all logs for admin
        if user_id:
            # Admin filtering for specific user
            query = query.filter(ApiLogs.user_id == user_id)
    else:
        # Non-admin only sees their own logs
        query = query.filter(ApiLogs.user_id == user.id)

    # Apply other filters
    if start_date:
        query = query.filter(ApiLogs.created_at >= start_date)
    if end_date:
        query = query.filter(ApiLogs.created_at <= end_date)
    if machine_id:
        query = query.filter(
            ApiLogs.machine_id == machine_id
        )  # Removed str() conversion
    if model:
        query = query.filter(ApiLogs.model == model)
    if api_key_id:
        query = query.filter(ApiLogs.api_key_id == api_key_id)
    if flow_id:
        # For flow_id, we don't need to check user ownership if admin
        query = query.filter(ApiLogs.flow_id == flow_id)

    if order_by not in [
        "created_at",
        "total_response_time",
        "total_tokens",
        "prompt_tokens",
        "completion_tokens",
        "ttft",
        "model",
        "machine_id",
    ]:
        raise HTTPException(status_code=400, detail="Invalid order_by field")
    if order == "desc":
        query = query.order_by(getattr(ApiLogs, order_by).desc())
    elif order == "asc":
        query = query.order_by(getattr(ApiLogs, order_by).asc())
    else:
        raise HTTPException(status_code=400, detail="Invalid order direction")
    logs = query.offset(offset).limit(page_size).all()
    total_logs = query.count()

    def exclude_model_from_pricing(log):
        l = log.dict()
        model_pricing = l.get("model_pricing")

        if model_pricing is None:
            return l

        if model_pricing.get("model") is not None:
            model_pricing.pop("model")

        l["model_pricing"] = model_pricing
        return l

    filtered_logs = list(map(exclude_model_from_pricing, logs))

    return {
        "logs": filtered_logs,
        "total": total_logs,
        "page": page,
        "page_size": page_size,
    }


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
async def total_inference_calls(
    db: Session = Depends(get_session),
    user: User = Depends(verify_user),
):
    total = db.exec(
        select(func.count()).select_from(ApiLogs).where(ApiLogs.user_id == user.id)
    ).first()
    return {"total": total}


@router.get("/api-logs/metrics")
async def get_logs_metrics(
    db: Session = Depends(get_session),
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
    query = select(
        time_bucket_fn(ApiLogs.created_at).label("timestamp"),
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

    # Add grouping and ordering
    query = query.group_by(time_bucket_fn(ApiLogs.created_at), ApiLogs.model).order_by(
        time_bucket_fn(ApiLogs.created_at)
    )

    # Execute the query once
    results = db.execute(query).all()

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
