import re
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Response
from src.router.models.logs import ApiLogs
from sqlmodel import Session, select, func, text
from src.router.api.v1.network import generate
from src.router.core.security import verify_user
from src.router.core.types import User
from src.router.schemas.ai import AiRequest, Message, Function, Tool
from src.router.models.flows import Flows
from src.router.schemas.flows import (
    FlowRequest,
    FlowChatCompletion,
    FlowAnalytics,
    TimeRange,
    ModelStats,
    TimeSeriesEntry,
    FlowStats,
)
from src.router.db.session import get_session
from src.router.utils.network import get_random_machines, PROXY_PORT
import requests
import json
from src.router.api.v1.docs.flows import (
    CREATE_FLOW_DOCS,
    LIST_FLOWS_DOCS,
)
from datetime import datetime, timedelta

router = APIRouter()


def extract_variables(system_prompt: str) -> List[str]:
    # get variables from system prompt which are in the form of {{variable_name}}
    variables = re.findall(r"\{\{([^}]+)\}\}", system_prompt)
    return variables


@router.post("/flows", **CREATE_FLOW_DOCS)
def create_flow(
    flow: FlowRequest,
    db: Session = Depends(get_session),
    user: User = Depends(verify_user),
):
    variables = extract_variables(flow.system_prompt)

    new_flow = Flows(
        system_prompt=flow.system_prompt,
        name=flow.name,
        variables=variables,
        user_id=user.id,
    )
    db.add(new_flow)
    db.commit()
    db.refresh(new_flow)
    return new_flow


@router.get("/flows", **LIST_FLOWS_DOCS)
def list_all_flows(db: Session = Depends(get_session)):
    flows = db.query(Flows).all()
    return flows


@router.get(
    "/flows/{flow_id}",
    summary="Get Flow by ID",
    description="""Retrieves a specific flow by its ID.

### Authentication
- Requires a valid authentication token
- Token must be passed in the Authorization header

### Path Parameters
- `flow_id`: Unique identifier of the flow

### Response Format
```json
{
    "id": string,
    "name": string,
    "system_prompt": string,
    "variables": string[]
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
        "detail": "Flow not found"
    }
    ```

### Notes
- Returns 404 if flow ID doesn't exist
- System prompt is returned in template form with variables""",
    response_description="Returns the requested flow object",
    responses={
        200: {
            "description": "Successfully retrieved flow",
            "content": {
                "application/json": {
                    "example": {
                        "id": "flow_123",
                        "name": "Translation Assistant",
                        "system_prompt": "You are helping with {{task}} in {{language}}",
                        "variables": ["task", "language"],
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
        404: {
            "description": "Flow not found",
            "content": {"application/json": {"example": {"detail": "Flow not found"}}},
        },
    },
)
def get_flow(flow_id: str, db: Session = Depends(get_session)):
    flow = db.exec(select(Flows).where(Flows.id == flow_id)).first()
    if not flow:
        raise HTTPException(status_code=404, detail="Flow not found")
    return flow


@router.put(
    "/flows/{flow_id}",
    summary="Update Flow",
    description="""Updates an existing flow's system prompt and name.

### Authentication
- Requires a valid authentication token
- Token must be passed in the Authorization header

### Path Parameters
- `flow_id`: Unique identifier of the flow

### Request Body
```json
{
    "system_prompt": string,  // New system prompt with optional variables
    "name": string           // New name for the flow
}
```

### Response Format
```json
{
    "id": string,
    "name": string,
    "system_prompt": string,
    "variables": string[]    // Updated array of extracted variables
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
        "detail": "Flow not found"
    }
    ```

### Notes
- Variables are re-extracted from the updated system prompt
- All fields must be provided (no partial updates)
- Previous variables are replaced with newly extracted ones""",
    response_description="Returns the updated flow object",
    responses={
        200: {
            "description": "Successfully updated flow",
            "content": {
                "application/json": {
                    "example": {
                        "id": "flow_123",
                        "name": "Updated Translation Assistant",
                        "system_prompt": "You are helping with {{task}} in {{language}} and {{style}}",
                        "variables": ["task", "language", "style"],
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
        404: {
            "description": "Flow not found",
            "content": {"application/json": {"example": {"detail": "Flow not found"}}},
        },
    },
)
def update_flow(flow_id: str, flow: FlowRequest, db: Session = Depends(get_session)):
    existing_flow = db.query(Flows).filter(Flows.id == flow_id).first()
    if not existing_flow:
        raise HTTPException(status_code=404, detail="Flow not found")

    existing_flow.system_prompt = flow.system_prompt
    existing_flow.name = flow.name
    existing_flow.variables = extract_variables(flow.system_prompt)

    db.commit()
    db.refresh(existing_flow)
    return existing_flow


@router.delete(
    "/flows/{flow_id}",
    summary="Delete Flow",
    description="""Deletes a specific flow by its ID.

### Authentication
- Requires a valid authentication token
- Token must be passed in the Authorization header

### Path Parameters
- `flow_id`: Unique identifier of the flow

### Response Format
```json
{
    "message": "Flow deleted successfully"
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
        "detail": "Flow not found"
    }
    ```

### Notes
- Operation cannot be undone
- All associated data is permanently deleted""",
    response_description="Returns a success message",
    responses={
        200: {
            "description": "Successfully deleted flow",
            "content": {
                "application/json": {
                    "example": {"message": "Flow deleted successfully"}
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
            "description": "Flow not found",
            "content": {"application/json": {"example": {"detail": "Flow not found"}}},
        },
    },
)
def delete_flow(flow_id: str, db: Session = Depends(get_session)):
    existing_flow = db.query(Flows).filter(Flows.id == flow_id).first()
    if not existing_flow:
        raise HTTPException(status_code=404, detail="Flow not found")

    db.delete(existing_flow)
    db.commit()
    return {"message": "Flow deleted successfully"}


@router.post(
    "/v1/flow/{flow_id}/chat/completions",
    summary="Generate Chat Completion with Flow",
    description="""Generates a chat completion using a specific flow's system prompt and variables.

### Authentication
- Requires a valid authentication token
- Token must be passed in the Authorization header
- Sufficient credits required for generation

### Path Parameters
- `flow_id`: Unique identifier of the flow to use

### Request Body
```json
{
    "model": string,
    "messages": [
        {
            "role": "user" | "assistant",
            "content": string
        }
    ],
    "variables": {
        "variable_name": any  // Values for variables in system prompt
    },
    "stream": boolean,
    "tools": [
        {
            "type": "function",
            "function": {
                "name": string,
                "description": string,
                "parameters": object
            }
        }
    ],
    "tool_choice": string
}
```

### Response Format (Non-Streaming)
```json
{
    "id": string,
    "object": "chat.completion",
    "created": int,
    "model": string,
    "choices": [
        {
            "index": 0,
            "message": {
                "role": "assistant",
                "content": string,
                "tool_calls": [
                    {
                        "id": string,
                        "type": "function",
                        "function": {
                            "name": string,
                            "arguments": string
                        }
                    }
                ]
            },
            "finish_reason": "stop" | "length" | "tool_calls"
        }
    ],
    "usage": {
        "prompt_tokens": int,
        "completion_tokens": int,
        "total_tokens": int
    }
}
```

### Streaming Response Format
Server-sent events with the following data structure:
```json
{
    "content": string | null,
    "tool_calls": [
        {
            "id": string,
            "type": "function",
            "function": {
                "name": string,
                "arguments": string
            }
        }
    ]
}
```

### Error Responses
- `400 Bad Request`:
    ```json
    {
        "detail": "System message is not allowed in request"
    }
    ```
    ```json
    {
        "detail": "Variables are required but none were provided"
    }
    ```
    ```json
    {
        "detail": "Missing required variables: var1, var2"
    }
    ```
- `401 Unauthorized`:
    ```json
    {
        "detail": "Could not validate credentials"
    }
    ```
- `402 Payment Required`:
    ```json
    {
        "detail": "Insufficient credits"
    }
    ```
- `404 Not Found`:
    ```json
    {
        "detail": "Flow not found"
    }
    ```

### Notes
- System message is automatically added from flow's system prompt
- All variables in system prompt must be provided
- Supports both streaming and non-streaming responses
- Credits are deducted based on token usage
- Tool calls are optional and depend on model capabilities""",
    response_description="Returns the chat completion response",
    responses={
        200: {
            "description": "Successfully generated completion",
            "content": {
                "application/json": {
                    "example": {
                        "id": "chatcmpl-123",
                        "object": "chat.completion",
                        "created": 1677858242,
                        "model": "gpt-4",
                        "choices": [
                            {
                                "index": 0,
                                "message": {
                                    "role": "assistant",
                                    "content": "Here's the translation in French: Bonjour le monde!",
                                    "tool_calls": None,
                                },
                                "finish_reason": "stop",
                            }
                        ],
                        "usage": {
                            "prompt_tokens": 25,
                            "completion_tokens": 12,
                            "total_tokens": 37,
                        },
                    }
                }
            },
        },
        400: {
            "description": "Bad Request - Invalid parameters",
            "content": {
                "application/json": {
                    "examples": {
                        "system_message": {
                            "value": {
                                "detail": "System message is not allowed in request"
                            }
                        },
                        "missing_variables": {
                            "value": {
                                "detail": "Missing required variables: language, task"
                            }
                        },
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
        402: {
            "description": "Payment Required - Insufficient credits",
            "content": {
                "application/json": {"example": {"detail": "Insufficient credits"}}
            },
        },
        404: {
            "description": "Flow not found",
            "content": {"application/json": {"example": {"detail": "Flow not found"}}},
        },
    },
)
async def generate_with_flow_id(
    flow_id: str,
    req: FlowChatCompletion,
    db: Session = Depends(get_session),
    user: User = Depends(verify_user),
):
    if any(msg.role == "system" for msg in req.messages):
        raise HTTPException(
            status_code=400,
            detail="System message is not allowed in request",
        )

    flow = db.exec(select(Flows).where(Flows.id == flow_id)).first()
    if not flow:
        raise HTTPException(status_code=404, detail="Flow not found")

    system_prompt = flow.system_prompt
    required_vars = flow.variables

    if required_vars:
        if req.variables is None:
            raise HTTPException(
                status_code=400, detail="Variables are required but none were provided"
            )
        missing_vars = [var for var in required_vars if var not in req.variables]
        if missing_vars:
            raise HTTPException(
                status_code=400,
                detail=f"Missing required variables: {', '.join(missing_vars)}",
            )

        for var in required_vars:
            system_prompt = system_prompt.replace(
                f"{{{{{var}}}}}", str(req.variables[var])
            )

    req.messages.insert(0, Message(role="system", content=system_prompt))

    response = await generate(
        req=AiRequest(
            model=req.model,
            messages=req.messages,
            stream=req.stream,
            model_provider=None,
            tools=req.tools,
            tool_choice=req.tool_choice,
        ),
        flow_id=flow_id,
        user=user,
        db=db,
    )

    return response


@router.get(
    "/flows/{flow_id}/stats",
    response_model=FlowStats,
    summary="Get Flow Stats",
    description="Get basic usage statistics and time series data for a specific flow",
)
async def get_flow_stats(
    flow_id: str,
    db: Session = Depends(get_session),
    user: User = Depends(verify_user),
) -> FlowStats:
    # Verify flow exists
    flow = db.exec(select(Flows).where(Flows.id == flow_id)).first()
    if not flow:
        raise HTTPException(status_code=404, detail="Flow not found")

    # Get the latest log entry for this flow
    log = db.exec(
        select(ApiLogs)
        .where(ApiLogs.flow_id == flow_id)
        .order_by(ApiLogs.created_at.desc())
        .limit(1)
    ).first()

    if not log:
        raise HTTPException(status_code=404, detail="No stats available for this flow")

    # Get time series data for the last 24 hours
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(hours=24)

    time_series = db.exec(
        select(
            func.date_trunc("hour", ApiLogs.created_at).label("timestamp"),
            func.sum(ApiLogs.total_tokens).label("tokens"),
            func.sum(ApiLogs.prompt_tokens).label("prompt_tokens"),
            func.sum(ApiLogs.completion_tokens).label("completion_tokens"),
            ApiLogs.model_pricing,
        )
        .where(
            ApiLogs.flow_id == flow_id,
            ApiLogs.created_at >= start_date,
            ApiLogs.created_at <= end_date,
        )
        .group_by(
            func.date_trunc("hour", ApiLogs.created_at),
            ApiLogs.model_pricing,
        )
        .order_by(func.date_trunc("hour", ApiLogs.created_at))
    ).all()

    # Process time series data
    time_series_data = []
    for entry in time_series:
        try:
            model_pricing = entry.model_pricing
            if (
                model_pricing
                and hasattr(model_pricing, "prompt_token")
                and hasattr(model_pricing, "completion_token")
            ):
                cost = entry.prompt_tokens * float(
                    model_pricing.prompt_token
                ) + entry.completion_tokens * float(model_pricing.completion_token)
            else:
                cost = 0.0
        except (AttributeError, ValueError):
            cost = 0.0

        time_series_data.append(
            {"timestamp": entry.timestamp, "tokens": entry.tokens, "cost": cost}
        )

    # Get current stats from the latest log
    current_pricing = {}
    if (
        log.model_pricing
        and hasattr(log.model_pricing, "prompt_token")
        and hasattr(log.model_pricing, "completion_token")
    ):
        current_pricing = {
            "prompt_token": float(log.model_pricing.prompt_token),
            "completion_token": float(log.model_pricing.completion_token),
        }
        total_cost = (
            log.prompt_tokens * current_pricing["prompt_token"]
            + log.completion_tokens * current_pricing["completion_token"]
        )
    else:
        total_cost = 0.0

    return FlowStats(
        total_tokens=log.total_tokens,
        prompt_tokens=log.prompt_tokens,
        completion_tokens=log.completion_tokens,
        total_cost=total_cost,
        model=log.model,
        model_pricing=current_pricing,
        total_response_time=log.total_response_time,
        ttft=log.ttft,
        time_series=time_series_data,
    )
