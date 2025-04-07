import re
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from src.router.models.logs import ApiLogs
from sqlmodel import select, func
from src.router.api.v1.network import chatCompletionGenerate
from src.router.core.security import verify_user
from src.router.core.types import User
from src.router.schemas.ai import AiRequest, Message
from src.router.models.flows import Flows
from src.router.schemas.flows import (
    FlowRequest,
    FlowChatCompletion,
    FlowStats,
)
from src.router.db.session import DBSession
from src.router.api.v1.docs.flows import (
    CREATE_FLOW_DOCS,
    LIST_FLOWS_DOCS,
)
from datetime import datetime, timedelta
from src.router.utils.redis import redis_client
import json
from src.router.utils.logger import logger
from async_lru import alru_cache
import traceback

router = APIRouter()


def extract_variables(system_prompt: str) -> List[str]:
    # get variables from system prompt which are in the form of {{variable_name}}
    variables = re.findall(r"\{\{([^}]+)\}\}", system_prompt)
    return variables


@router.post("/flows", **CREATE_FLOW_DOCS)
async def create_flow(
    flow: FlowRequest,
    db: DBSession,
    user: User = Depends(verify_user),
):
    track("create_flow_request", {
        "user_id": str(user.id),
        "flow_name": flow.name,
        "variables_count": len(extract_variables(flow.system_prompt))
    })
    
    variables = extract_variables(flow.system_prompt)

    new_flow = Flows(
        system_prompt=flow.system_prompt,
        name=flow.name,
        variables=variables,
        user_id=str(user.id),
    )
    db.add(new_flow)
    await db.commit()
    await db.refresh(new_flow)
    return new_flow


@router.get("/flows", **LIST_FLOWS_DOCS)
async def list_all_flows(db: DBSession):
    flows = await db.exec(select(Flows))
    return flows.all()


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
async def get_flow(flow_id: str, db: DBSession):
    flow = await db.exec(select(Flows).where(Flows.id == flow_id))
    flow = flow.first()
    if not flow:
        track("get_flow_error", {"flow_id": flow_id, "error": "flow_not_found"})
        raise HTTPException(status_code=404, detail="Flow not found")
    
    track("get_flow_success", {
        "flow_id": flow_id,
        "flow_name": flow.name,
        "variables_count": len(flow.variables)
    })
    
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
- `403 Forbidden`:
    ```json
    {
        "detail": "Not authorized to modify this flow"
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
- Previous variables are replaced with newly extracted ones
- Only the flow owner can update the flow""",
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
        403: {
            "description": "Forbidden - Not the flow owner",
            "content": {
                "application/json": {
                    "example": {"detail": "Not authorized to modify this flow"}
                }
            },
        },
        404: {
            "description": "Flow not found",
            "content": {"application/json": {"example": {"detail": "Flow not found"}}},
        },
    },
)
async def update_flow(flow_id: str, flow: FlowRequest, db: DBSession):
    # existing_flow = db.query(Flows).filter(Flows.id == flow_id).first()
    existing_flow = await db.exec(select(Flows).where(Flows.id == int(flow_id)))
    existing_flow = existing_flow.first()

    if not existing_flow:
        track("update_flow_error", {
            "flow_id": flow_id,
            "error": "flow_not_found",
            "user_id": str(user.id)
        })
        raise HTTPException(status_code=404, detail="Flow not found")
    
    # Check if user is authorized to update this flow
    is_admin = False
    is_admin = 'admin' in user.roles
    
    if existing_flow.user_id != str(user.id) and not is_admin:
        track("update_flow_error", {
            "flow_id": flow_id,
            "error": "not_authorized",
            "user_id": str(user.id),
            "flow_owner_id": existing_flow.user_id
        })
        raise HTTPException(
            status_code=403,
            detail="Not authorized to modify this flow"
        )

    # Save old values for tracking
    old_variables_count = len(existing_flow.variables or [])
    
    existing_flow.system_prompt = flow.system_prompt
    existing_flow.name = flow.name
    existing_flow.variables = extract_variables(flow.system_prompt)

    await db.commit()
    await db.refresh(existing_flow)
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
- `403 Forbidden`:
    ```json
    {
        "detail": "Not authorized to delete this flow"
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
- All associated data is permanently deleted
- Only the flow owner can delete the flow""",
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
        403: {
            "description": "Forbidden - Not the flow owner",
            "content": {
                "application/json": {
                    "example": {"detail": "Not authorized to delete this flow"}
                }
            },
        },
        404: {
            "description": "Flow not found",
            "content": {"application/json": {"example": {"detail": "Flow not found"}}},
        },
    },
)
async def delete_flow(flow_id: str, db: DBSession):
    existing_flow = await db.exec(select(Flows).where(Flows.id == int(flow_id)))
    existing_flow = existing_flow.first()

    if not existing_flow:
        track("delete_flow_error", {
            "flow_id": flow_id,
            "error": "flow_not_found",
            "user_id": str(user.id)
        })
        raise HTTPException(status_code=404, detail="Flow not found")

    await db.delete(existing_flow)
    await db.commit()
    await redis_client.delete(f"flow:{flow_id}")
    get_cached_flow.cache_clear()
    return {"message": "Flow deleted successfully"}


@alru_cache(maxsize=100, ttl=3600)  # 1 hour TTL
async def get_cached_flow(flow_id: int) -> Optional[Flows]:
    """Get flow from cache with TTL, using async_lru package"""
    logger.info(f"Cache miss for flow_id: {flow_id}")

    # Try to get from Redis first
    flow_key = f"flow:{flow_id}"
    cached_flow = await redis_client.get(flow_key)

    if cached_flow:
        logger.info(f"Redis cache hit for flow_id: {flow_id}")
        flow_dict = json.loads(cached_flow)
        return Flows(**flow_dict)

    logger.info(f"Complete cache miss for flow_id: {flow_id}")
    return None


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
    db: DBSession,
    user: User = Depends(verify_user),
):
    # get user credits
    user_credits = await redis_client.get(f"user_credit:{user.id}")
    logger.info(f"User credits: {user_credits}")

    if float(user_credits) <= 0:
        raise HTTPException(status_code=402, detail="Insufficient credits")

    logger.info(f"Generating with flow ID: {flow_id}")
    if any(msg.role == "system" for msg in req.messages):
        track("flow_completion_error", {
            "flow_id": flow_id,
            "error": "system_message_not_allowed",
            "user_id": str(user.id)
        })
        raise HTTPException(
            status_code=400,
            detail="System message is not allowed in request",
        )

    # Cast flow_id to integer before querying
    try:
        flow_id_int = int(flow_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid flow ID format")

    # Try LRU cache first, then Redis, then database

    flow = await get_cached_flow(flow_id_int)
    logger.info(f"Flow lru cache: {get_cached_flow.cache_info()}")
    if not flow:
        flow = await db.exec(select(Flows).where(Flows.id == flow_id_int))
        flow = flow.one_or_none()
        if flow:
            flow_dict = {
                "id": flow.id,
                "name": flow.name,
                "system_prompt": flow.system_prompt,
                "variables": flow.variables,
            }
            await redis_client.set(f"flow:{flow_id_int}", json.dumps(flow_dict))
            get_cached_flow.cache_clear()  # Clear LRU cache to update with new value

    if not flow:
        track("flow_completion_error", {
            "flow_id": flow_id,
            "error": "flow_not_found",
            "user_id": str(user.id)
        })
        raise HTTPException(status_code=404, detail="Flow not found")

    system_prompt = flow.system_prompt
    required_vars = flow.variables

    if required_vars:
        if req.variables is None:
            track("flow_completion_error", {
                "flow_id": flow_id,
                "error": "variables_required",
                "user_id": str(user.id)
            })
            raise HTTPException(
                status_code=400,
                detail="Variables are required but none were provided",
            )
        missing_vars = [var for var in required_vars if var not in req.variables]
        if missing_vars:
            track("flow_completion_error", {
                "flow_id": flow_id,
                "error": "missing_variables",
                "missing_vars": ", ".join(missing_vars),
                "user_id": str(user.id)
            })
            raise HTTPException(
                status_code=400,
                detail=f"Missing required variables: {', '.join(missing_vars)}",
            )

        for var in required_vars:
            system_prompt = system_prompt.replace(
                f"{{{{{var}}}}}", str(req.variables[var])
            )

    req.messages.insert(0, Message(role="system", content=system_prompt))
    
    track("flow_completion_processing", {
        "flow_id": flow_id,
        "model": req.model,
        "user_id": str(user.id),
        "variables_count": len(required_vars) if required_vars else 0
    })

    try:
        response = await chatCompletionGenerate(
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
    except Exception as e:
        # Get full traceback
        error_trace = traceback.format_exc()
        logger.error(
            f"Error generating with flow ID {flow_id}:\n"
            f"Error: {str(e)}\n"
            f"Traceback:\n{error_trace}"
        )

        raise HTTPException(status_code=500, detail=str(e))

    return response
