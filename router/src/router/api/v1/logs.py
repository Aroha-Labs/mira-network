from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional, Literal, Dict, Any, Union
from datetime import datetime
from src.router.core.types import User
from src.router.core.security import verify_user
from src.router.utils.opensearch import (
    opensearch_client,
    OPENSEARCH_LLM_USAGE_LOG_INDEX,
)
from src.router.utils.nr import track
from src.router.utils.logger import logger

router = APIRouter()

# Type aliases for OpenSearch queries
OpenSearchQuery = Dict[str, Union[Dict[str, Any], str]]
must_conditions: list[OpenSearchQuery] = []


@router.get(
    "/api-logs",
    summary="List API Logs",
    description="""Retrieves paginated API logs for the authenticated user.

### Authentication
- Requires a valid authentication token
- Token must be passed in the Authorization header

### Query Parameters
- `page`: Page number (default: 1)
- `page_size`: Number of items per page (default: 10, max: 100)
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
    ```json
    {
        "detail": "page_size must be between 1 and 100"
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
- Response is paginated with a maximum of 100 items per page
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
                "application/json": {
                    "examples": {
                        "invalid_order": {
                            "value": {"detail": "Invalid order_by field"}
                        },
                        "invalid_page_size": {
                            "value": {"detail": "page_size must be between 1 and 100"}
                        }
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
    user: User = Depends(verify_user),
    page: int = Query(default=1, ge=1, description="Page number"),
    page_size: int = Query(default=10, ge=1, le=100, description="Number of items per page (max: 100)"),
    start_date: Optional[datetime] = Query(default=None, description="Filter logs after this date (ISO 8601)"),
    end_date: Optional[datetime] = Query(default=None, description="Filter logs before this date (ISO 8601)"),
    machine_id: Optional[str] = Query(default=None, description="Filter by machine ID"),
    model: Optional[str] = Query(default=None, description="Filter by model name"),
    api_key_id: Optional[int] = Query(default=None, description="Filter by API key ID"),
    user_id: Optional[str] = Query(default=None, description="Filter by user ID (admin only)"),
    order_by: Literal["created_at", "model", "machine_id"] = Query(
        default="created_at",
        description="Field to sort by"
    ),
    order: Literal["asc", "desc"] = Query(default="desc", description="Sort direction"),
    flow_id: Optional[str] = Query(default=None, description="Filter by flow ID"),
):
    # Validate page_size
    if page_size > 100:
        track("list_api_logs_error", {
            "user_id": str(user.id),
            "error": "invalid_page_size",
            "requested_page_size": page_size
        })
        raise HTTPException(
            status_code=400,
            detail="page_size must be between 1 and 100"
        )

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
            must_conditions.append({"term": {"machine_id": str(machine_id)}})
        if model:
            must_conditions.append({"match": {"model": model}})
        if api_key_id:
            must_conditions.append({"term": {"api_key_id": str(api_key_id)}})
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
    response_description="Returns the total number of inference calls made by the user",
)
async def total_inference_calls(user: User = Depends(verify_user)):
    track("total_inference_calls_request", {"user_id": str(user.id)})
    
    query = {
        "query": {
            "bool": {
                "must": [
                    {"match": {"user_id": user.id}},
                    {"term": {"doc_type": "model_usage"}}
                ]
            }
        },
        "track_total_hits": True,
        "size": 0
    }

    try:
        response = opensearch_client.search(
            index=OPENSEARCH_LLM_USAGE_LOG_INDEX,
            body=query,
        )
        total = response["hits"]["total"]["value"]

        track("total_inference_calls_response", {
            "user_id": str(user.id),
            "total_calls": total
        })

        return {"total": total}
    except Exception as e:
        logger.error(f"Error getting total inference calls: {e}")
        track("total_inference_calls_error", {
            "user_id": str(user.id),
            "error": str(e)
        })
        raise HTTPException(
            status_code=500,
            detail=f"Error getting total inference calls: {str(e)}"
        )


@router.get("/api-logs/metrics")
async def get_logs_metrics(
    user: User = Depends(verify_user),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    machine_id: Optional[str] = None,
    model: Optional[str] = None,
    api_key_id: Optional[int] = None,
    user_id: Optional[str] = None,
    flow_id: Optional[str] = None,
):
    track("get_logs_metrics_request", {"user_id": str(user.id)})

    # Access control
    if user_id and "admin" not in user.roles:
        track("get_logs_metrics_error", {
            "user_id": str(user.id),
            "error": "permission_denied",
            "requested_user_id": user_id
        })
        raise HTTPException(
            status_code=403, detail="Only admins can query other users' logs"
        )

    # Build OpenSearch query
    must_conditions = [{"term": {"doc_type": "model_usage"}}]

    # Add filters
    if user_id:
        must_conditions.append({"match": {"user_id": user_id}})
    else:
        if "admin" not in user.roles:
            must_conditions.append({"match": {"user_id": user.id}})

    if start_date:
        must_conditions.append(
            {"range": {"timestamp": {"gte": start_date}}}
        )
    if end_date:
        must_conditions.append(
            {"range": {"timestamp": {"lte": end_date}}}
        )
    if machine_id:
        must_conditions.append({"term": {"machine_id": str(machine_id)}})
    if model:
        must_conditions.append({"match": {"model": model}})
    if api_key_id:
        must_conditions.append({"term": {"api_key_id": str(api_key_id)}})
    if flow_id:
        must_conditions.append({"term": {"flow_id": flow_id}})

    # Build aggregations
    query = {
        "query": {"bool": {"must": must_conditions}},
        "aggs": {
            "total_tokens": {"sum": {"field": "total_tokens"}},
            "prompt_tokens": {"sum": {"field": "prompt_tokens"}},
            "completion_tokens": {"sum": {"field": "completion_tokens"}},
            "avg_response_time": {"avg": {"field": "total_response_time"}},
            "avg_ttft": {"avg": {"field": "ttft"}},
            "total_cost": {"sum": {"field": "cost"}},
            "model_distribution": {
                "terms": {
                    "field": "model",
                    "size": 100
                }
            }
        },
        "size": 0
    }

    try:
        response = opensearch_client.search(
            index=OPENSEARCH_LLM_USAGE_LOG_INDEX,
            body=query,
        )

        aggs = response["aggregations"]
        model_distribution = {
            bucket["key"]: bucket["doc_count"]
            for bucket in aggs["model_distribution"]["buckets"]
        }

        track("get_logs_metrics_response", {
            "user_id": str(user.id),
            "total_tokens": aggs["total_tokens"]["value"],
            "models_count": len(model_distribution)
        })

        return {
            "total_tokens": int(aggs["total_tokens"]["value"]),
            "prompt_tokens": int(aggs["prompt_tokens"]["value"]),
            "completion_tokens": int(aggs["completion_tokens"]["value"]),
            "avg_response_time": float(aggs["avg_response_time"]["value"]) if aggs["avg_response_time"]["value"] is not None else 0.0,
            "avg_ttft": float(aggs["avg_ttft"]["value"]) if aggs["avg_ttft"]["value"] is not None else 0.0,
            "total_cost": float(aggs["total_cost"]["value"]) if aggs["total_cost"]["value"] is not None else 0.0,
            "model_distribution": list(model_distribution.items())
        }

    except Exception as e:
        logger.error(f"Error getting logs metrics from OpenSearch: {e}")
        track("get_logs_metrics_error", {
            "user_id": str(user.id),
            "error": str(e)
        })
        raise HTTPException(
            status_code=500,
            detail=f"Error getting logs metrics: {str(e)}"
        )


@router.get(
    "/usage-stats",
    summary="Get Usage Statistics",
    response_description="Returns usage statistics for the specified time period",
)
async def get_usage_stats(
    user: User = Depends(verify_user),
    start_date: Optional[datetime] = Query(default=None),
    end_date: Optional[datetime] = Query(default=None),
    machine_id: Optional[str] = Query(default=None),
    model: Optional[str] = Query(default=None),
    api_key_id: Optional[int] = Query(default=None),
    user_id: Optional[str] = Query(default=None),
    flow_id: Optional[str] = Query(default=None),
    interval: str = Query(default="1h", description="Time bucket interval (e.g. 1h, 1d)"),
):
    track("get_usage_stats_request", {
        "user_id": str(user.id),
        "interval": interval
    })

    # Access control
    if user_id and "admin" not in user.roles:
        track("get_usage_stats_error", {
            "user_id": str(user.id),
            "error": "permission_denied",
            "requested_user_id": user_id
        })
        raise HTTPException(
            status_code=403, detail="Only admins can query other users' logs"
        )

    # Build OpenSearch query
    must_conditions = [{"term": {"doc_type": "model_usage"}}]

    # Add filters
    if user_id:
        must_conditions.append({"match": {"user_id": user_id}})
    else:
        if "admin" not in user.roles:
            must_conditions.append({"match": {"user_id": user.id}})

    if start_date:
        must_conditions.append(
            {"range": {"timestamp": {"gte": start_date.isoformat()}}}
        )
    if end_date:
        must_conditions.append(
            {"range": {"timestamp": {"lte": end_date.isoformat()}}}
        )
    if machine_id:
        must_conditions.append({"term": {"machine_id": str(machine_id)}})
    if model:
        must_conditions.append({"match": {"model": model}})
    if api_key_id:
        must_conditions.append({"term": {"api_key_id": str(api_key_id)}})
    if flow_id:
        must_conditions.append({"term": {"flow_id": flow_id}})

    # Build aggregations
    query = {
        "query": {"bool": {"must": must_conditions}},
        "aggs": {
            "usage_over_time": {
                "date_histogram": {
                    "field": "timestamp",
                    "fixed_interval": interval,
                    "format": "yyyy-MM-dd'T'HH:mm:ss.SSSZ"
                },
                "aggs": {
                    "by_model": {
                        "terms": {"field": "model"},
                        "aggs": {
                            "prompt_tokens": {"sum": {"field": "prompt_tokens"}},
                            "completion_tokens": {"sum": {"field": "completion_tokens"}},
                            "total_tokens": {"sum": {"field": "total_tokens"}},
                            "avg_response_time": {"avg": {"field": "total_response_time"}},
                            "avg_ttft": {"avg": {"field": "ttft"}},
                            "total_cost": {
                                "sum": {
                                    "script": {
                                        "source": "doc['cost'].value"
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        "size": 0
    }

    try:
        response = opensearch_client.search(
            index=OPENSEARCH_LLM_USAGE_LOG_INDEX,
            body=query,
        )

        # Transform results
        results = []
        for bucket in response["aggregations"]["usage_over_time"]["buckets"]:
            timestamp = bucket["key_as_string"]
            
            models_data = []
            for model_bucket in bucket["by_model"]["buckets"]:
                models_data.append({
                    "model": model_bucket["key"],
                    "prompt_tokens": int(model_bucket["prompt_tokens"]["value"]),
                    "completion_tokens": int(model_bucket["completion_tokens"]["value"]),
                    "total_tokens": int(model_bucket["total_tokens"]["value"]),
                    "avg_response_time": float(model_bucket["avg_response_time"]["value"]) if model_bucket["avg_response_time"]["value"] is not None else 0.0,
                    "avg_ttft": float(model_bucket["avg_ttft"]["value"]) if model_bucket["avg_ttft"]["value"] is not None else 0.0,
                    "total_cost": float(model_bucket["total_cost"]["value"]) if model_bucket["total_cost"]["value"] is not None else 0.0
                })

            results.append({
                "timestamp": timestamp,
                "models": models_data
            })

        track("get_usage_stats_response", {
            "user_id": str(user.id),
            "total_buckets": len(results)
        })

        return {"results": results}

    except Exception as e:
        logger.error(f"Error getting usage stats from OpenSearch: {e}")
        track("get_usage_stats_error", {
            "user_id": str(user.id),
            "error": str(e)
        })
        raise HTTPException(
            status_code=500,
            detail=f"Error getting usage statistics: {str(e)}"
        )
