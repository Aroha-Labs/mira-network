from src.router.utils.logger import logger
from typing import Optional, Literal
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import select
from src.router.core.types import User
from src.router.models.logs import ApiLogs
from src.router.db.session import DBSession
from src.router.core.security import verify_user
from sqlalchemy import func
from sqlalchemy.types import Float
from datetime import datetime, timedelta
from src.router.utils.opensearch import (
    opensearch_client,
    OPENSEARCH_LLM_USAGE_LOG_INDEX,
)
from src.router.utils.nr import track
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
    track("list_api_logs_request", {
        "user_id": str(user.id),
        "page": page,
        "page_size": page_size,
        "is_admin": "admin" in user.roles,
        "has_filters": any([start_date, end_date, machine_id, model, api_key_id, user_id, flow_id]),
        "requested_user_id": user_id
    })
    
    try:
        # Build OpenSearch query
        must_conditions = [{"term": {"doc_type": "model_usage"}}]

        # Access control
        if user_id:
            if "admin" not in user.roles:
                track("list_api_logs_error", {
                    "user_id": str(user.id),
                    "error": "permission_denied",
                    "requested_user_id": user_id
                })
                raise HTTPException(
                    status_code=403, detail="Only admins can query other users' logs"
                )
            must_conditions.append({"match": {"user_id": user_id}})
        else:
            if "admin" not in user.roles:
                must_conditions.append({"match": {"user_id": user.id}})

        # Add filters
        if start_date:
            must_conditions.append(
                {"range": {"timestamp": {"gte": start_date.isoformat()}}}
            )
        if end_date:
            must_conditions.append(
                {"range": {"timestamp": {"lte": end_date.isoformat()}}}
            )
        if machine_id:
            must_conditions.append({"term": {"machine_id": machine_id}})
        if model:
            must_conditions.append({"match": {"model": model}})
        if api_key_id:
            must_conditions.append({"term": {"api_key_id": api_key_id}})
        if flow_id:
            must_conditions.append({"term": {"flow_id": flow_id}})

        # Calculate pagination
        start = (page - 1) * page_size

        # Build the full query
        query = {
            "query": {"bool": {"must": must_conditions}},
            "sort": [
                {
                    order_by if order_by != "created_at" else "timestamp": {
                        "order": order
                    }
                }
            ],
            "from": start,
            "size": page_size,
            "track_total_hits": True,
        }

        # Execute search
        response = opensearch_client.search(
            index=OPENSEARCH_LLM_USAGE_LOG_INDEX,
            body=query,
        )

        # Transform results
        logs = []
        for hit in response["hits"]["hits"]:
            source = hit["_source"]
            logs.append(
                {
                    "id": hit["_id"],
                    "user_id": source.get("user_id"),
                    "api_key_id": source.get("api_key_id"),
                    "payload": source.get("request"),
                    "request_payload": source.get("request"),
                    "ttft": source.get("ttft"),
                    "response": source.get("response"),
                    "prompt_tokens": source.get("prompt_tokens"),
                    "completion_tokens": source.get("completion_tokens"),
                    "total_tokens": source.get("total_tokens"),
                    "total_response_time": source.get("total_response_time"),
                    "model": source.get("model"),
                    "model_pricing": {
                        "prompt_token": source.get("costs", {}).get("prompt_token", 0),
                        "completion_token": source.get("costs", {}).get(
                            "completion_token", 0
                        ),
                    },
                    "machine_id": source.get("machine_id"),
                    "created_at": source.get("timestamp"),
                    "flow_id": source.get("flow_id"),
                }
            )

        total_hits = response["hits"]["total"]["value"]
        total_pages = (total_hits + page_size - 1) // page_size
        
        track("list_api_logs_response", {
            "user_id": str(user.id),
            "total_hits": total_hits,
            "logs_returned": len(logs),
            "pages": total_pages
        })

        return {
            "logs": logs,
            "total": total_hits,
            "page": page,
            "page_size": page_size,
            "pages": total_pages,
        }

    except Exception as e:
        track("list_api_logs_error", {
            "user_id": str(user.id),
            "error": str(e)
        })
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
    track("total_inference_calls_request", {"user_id": str(user.id)})
    
    try:
        total = await db.exec(
            select(func.count()).select_from(ApiLogs).where(ApiLogs.user_id == user.id)
        )
        total_count = total.first()
        
        track("total_inference_calls_response", {
            "user_id": str(user.id),
            "total_count": total_count
        })
        
        return {"total": total_count}
    except Exception as e:
        track("total_inference_calls_error", {
            "user_id": str(user.id),
            "error": str(e)
        })
        raise HTTPException(status_code=500, detail=f"Error fetching inference calls: {str(e)}")


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
    track("logs_metrics_request", {
        "user_id": str(user.id),
        "is_admin": "admin" in user.roles,
        "time_bucket": time_bucket,
        "has_filters": any([start_date, end_date, machine_id, model, api_key_id, user_id, flow_id])
    })
    
    # Handle permission errors
    if user_id and "admin" not in user.roles:
        track("logs_metrics_error", {
            "user_id": str(user.id),
            "error": "permission_denied",
            "requested_user_id": user_id
        })
        raise HTTPException(
            status_code=403, detail="Only admins can query other users' logs"
        )

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

    track("logs_metrics_response", {
        "user_id": str(user.id),
        "total_calls": total_calls,
        "time_series_points": len(time_series),
        "model_count": len(model_distribution)
    })
    
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
