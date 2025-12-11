from fastapi import APIRouter, Depends, HTTPException, Response, Request
from fastapi.responses import StreamingResponse
from sqlmodel import select
from src.router.db.session import DBSession
from src.router.core.security import verify_user, verify_machine
from src.router.core.types import User
import time
import json
from src.router.models.machines import Machine
from src.router.utils.redis import redis_client, get_online_machines
from src.router.utils.nr import track
from src.router.utils.logger import logger
from openai import AsyncOpenAI
from src.router.core.config import LITELLM_API_KEY, LITELLM_API_URL

router = APIRouter()

# Configure OpenAI client for LiteLLM
openai_client = AsyncOpenAI(
    api_key=LITELLM_API_KEY, 
    base_url=f"{LITELLM_API_URL}/v1"
)


@router.get(
    "/liveness/{network_ip}",
    summary="Check Machine Liveness [DEPRECATED]",
    description="""[DEPRECATED] Please use /liveness/id/{machine_id} endpoint instead.

This endpoint will be removed in future versions.

Checks if a specific machine is currently online and responding.

### Path Parameters
- `network_ip`: Network IP address of the machine to check

### Response Format
```json
{
    "network_ip": string,
    "status": "online" | "offline"
}
```""",
    response_description="Returns the machine's current status",
    deprecated=True,
)
async def check_liveness(network_ip: str):
    # Check if machine is in Redis liveness records
    async for key in redis_client.scan_iter(match="liveness:*"):
        nip = await redis_client.hget(key, "network_ip")
        if nip == network_ip:
            return {"network_ip": network_ip, "status": "online"}

    return {"network_ip": network_ip, "status": "offline"}


@router.get(
    "/liveness/id/{machine_id}",
    summary="Check Machine Liveness by ID",
    description="""Checks if a specific machine is currently online and responding.

### Path Parameters
- `machine_id`: ID of the machine to check

### Response Format
```json
{
    "machine_id": string,
    "status": "online" | "offline"
}
```""",
    response_description="Returns the machine's current status",
)
async def check_liveness_by_id(machine_id: str):
    # Direct check in Redis using machine_id
    exists = await redis_client.exists(f"liveness:{machine_id}")
    if exists:
        return {"machine_id": machine_id, "status": "online"}

    return {"machine_id": machine_id, "status": "offline"}


@router.post(
    "/liveness/{network_ip}",
    summary="Update Machine Liveness",
    description="""Updates the liveness status of a machine.

### Path Parameters
- `network_ip`: Network IP address of the machine to update

### Response Format
```json
{
    "machine_uid": string,
    "status": "online"
}
```

### Technical Details
- Sets TTL for liveness check
- Stores current network information in Redis
- Updates timestamp of last seen
- TTL is calculated based on initial registration time

### Error Responses
- `404 Not Found`:
    ```json
    {
        "detail": "Machine not found"
    }
    ```""",
    response_description="Returns the updated machine status",
    responses={
        200: {
            "description": "Successfully updated machine status",
            "content": {
                "application/json": {
                    "example": {
                        "machine_uid": "550e8400-e29b-41d4-a716-446655440000",
                        "status": "online",
                    }
                }
            },
        },
        404: {
            "description": "Machine not found",
            "content": {
                "application/json": {"example": {"detail": "Machine not found"}}
            },
        },
    },
)
async def set_liveness(
    network_ip: str,
    response: Response,
    db: DBSession,
    machine_auth: dict = Depends(verify_machine),
):
    track("set_liveness_request", {"network_ip": network_ip})

    logger.debug(f"Verifying machine token: {machine_auth}")
    logger.debug(f"Network IP: {network_ip}")

    # Verify the token is authorized for this machine
    authorized_ips = [m["network_ip"] for m in machine_auth["machines"]]
    logger.info(f"Authorized IPs for token: {authorized_ips}")
    logger.info(f"Requested network IP: {network_ip}")

    if network_ip not in authorized_ips:
        logger.warning(
            f"Token not authorized for machine {network_ip}. Authorized IPs: {authorized_ips}"
        )
        track(
            "set_liveness_error",
            {
                "network_ip": network_ip,
                "error": "token_not_authorized",
                "authorized_ips": authorized_ips,
            },
        )
        raise HTTPException(
            status_code=403, detail="Token not authorized for this machine"
        )

    # First look up the machine to get its ID
    machine = await db.exec(select(Machine).where(Machine.network_ip == network_ip))
    machine = machine.first()

    if not machine:
        track(
            "set_liveness_error",
            {"network_ip": network_ip, "error": "machine_not_found"},
        )
        raise HTTPException(status_code=404, detail="Machine not found")

    now = time.time()
    machine_id = str(machine.id)
    liveness_key = f"liveness:{machine_id}"
    ttl = 12  # seconds

    # Set the liveness data with a fixed TTL
    await redis_client.hset(
        liveness_key,
        mapping={
            "network_ip": network_ip,
            "timestamp": now,
        },
    )

    # Map machine_id to network_ip
    await redis_client.set(f"machine_id:{network_ip}", machine_id)

    await redis_client.expire(liveness_key, ttl)

    # Add debug headers
    response.headers["X-Liveness-Timestamp"] = str(now)
    response.headers["X-Liveness-TTL"] = str(ttl)

    logger.debug(f"Updated liveness for machine {machine_id} (IP: {network_ip})")

    return {
        "machine_id": machine_id,
        "network_ip": network_ip,
        "status": "online",
        "timestamp": now,
        "ttl": ttl,
    }


@router.get(
    "/machines",
    summary="List All Machines",
    description="""Retrieves a list of all registered machines with their current status.
    By default, disabled machines are excluded. Only admins can request disabled machines.""",
)
async def list_all_machines(
    db: DBSession,
    include_disabled: bool = False,
    user: User = Depends(verify_user),
):
    track(
        "list_machines_request",
        {
            "user_id": str(user.id),
            "include_disabled": include_disabled,
            "is_admin": "admin" in user.roles,
        },
    )

    if include_disabled and "admin" not in user.roles:
        track(
            "list_machines_error",
            {
                "user_id": str(user.id),
                "error": "permission_denied",
                "include_disabled": include_disabled,
            },
        )
        raise HTTPException(
            status_code=403, detail="Only admins can view disabled machines"
        )

    query = select(Machine)
    if not include_disabled:
        query = query.where(Machine.disabled == False)  # noqa: E712

    machines = await db.exec(query)
    machines = machines.all()

    online_machines = await get_online_machines()

    # Machine list doesn't need base URL anymore since we use relative paths
    
    return [
        {
            "id": machine.id,
            "network_ip": machine.network_ip,
            "name": machine.name,
            "description": machine.description,
            "created_at": machine.created_at.isoformat(),
            "disabled": machine.disabled,
            "status": ("online" if str(machine.id) in online_machines else "offline"),
            "traffic_weight": machine.traffic_weight,
            "supported_models": machine.supported_models,
            "proxy_base_url": f"/machines/{machine.id}",
            "openai_compatible_base": f"/machines/{machine.id}",
        }
        for machine in machines
    ]


@router.get(
    "/machines/{machine_id}/health",
    summary="Check Machine Health",
    description="""Check the health and availability of a specific machine.""",
)
async def check_machine_health(
    machine_id: str,
    db: DBSession,
    user: User = Depends(verify_user),
):
    # Get machine from database (cast machine_id to int)
    try:
        machine_id_int = int(machine_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid machine ID")
    
    machine = await db.exec(select(Machine).where(Machine.id == machine_id_int))
    machine = machine.first()

    if not machine:
        raise HTTPException(status_code=404, detail="Machine not found")

    # Check if machine is online in Redis
    liveness_key = f"liveness:{machine_id}"
    exists = await redis_client.exists(liveness_key)
    
    if not exists:
        return {
            "status": "offline",
            "machine_id": machine_id,
            "name": machine.name,
            "proxy_url": f"/v1/machines/{machine_id}",
        }

    return {
        "status": "online",
        "machine_id": machine_id,
        "name": machine.name,
        "proxy_url": f"/v1/machines/{machine_id}",
    }


@router.post(
    "/machines/{machine_id}/v1/chat/completions",
    summary="Machine-Specific Chat Completions",
    description="""Send chat completion requests directly to a specific machine.
    
    The model name will be automatically modified to target the specific machine.
    For example, 'gpt-4' becomes 'gpt-4-machine-123' for routing via LiteLLM.""",
)
async def machine_chat_completions(
    machine_id: str,
    request: Request,
    db: DBSession,
    user: User = Depends(verify_user),
):
    # Verify machine exists (cast machine_id to int)
    try:
        machine_id_int = int(machine_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid machine ID")
    
    machine = await db.exec(select(Machine).where(Machine.id == machine_id_int))
    machine = machine.first()
    
    if not machine:
        raise HTTPException(status_code=404, detail="Machine not found")
    
    # Check if machine is online
    if not await redis_client.exists(f"liveness:{machine_id}"):
        raise HTTPException(status_code=503, detail=f"Machine {machine_id} is offline")
    
    # Parse request body
    body = await request.body()
    data = json.loads(body)
    
    # Validate model is provided
    if "model" not in data:
        raise HTTPException(status_code=400, detail="Model is required")
    
    original_model = data["model"]
    
    # Check if machine supports this model
    if machine.supported_models and original_model not in machine.supported_models:
        raise HTTPException(
            status_code=400,
            detail=f"Model '{original_model}' is not supported by machine {machine_id}. Supported models: {', '.join(machine.supported_models)}"
        )
    
    # Modify model to target specific machine
    data["model"] = f"{original_model}-machine-{machine_id}"
    
    logger.info(f"Routing {original_model} to deployment: {data['model']}")
    
    # Call LiteLLM
    try:
        if data.get("stream", False):
            # Streaming response
            stream = await openai_client.chat.completions.create(**data)
            
            async def generate():
                async for chunk in stream:
                    yield f"data: {chunk.model_dump_json()}\n\n"
                yield "data: [DONE]\n\n"
            
            return StreamingResponse(
                generate(),
                media_type="text/event-stream",
            )
        else:
            # Regular response
            response = await openai_client.chat.completions.create(**data)
            return Response(
                content=response.model_dump_json(),
                media_type="application/json",
            )
    except Exception as e:
        # Check if it's a model not found error
        error_message = str(e)
        if "Invalid model name" in error_message or "400" in error_message:
            # Model deployment not found in LiteLLM
            raise HTTPException(
                status_code=400,
                detail=f"Model '{original_model}' is not available for machine {machine_id}. The deployment may not be configured in LiteLLM. Please contact admin to set up the model deployment."
            )
        elif "authentication" in error_message.lower() or "401" in error_message:
            raise HTTPException(
                status_code=500,
                detail="LiteLLM authentication error. Please contact admin."
            )
        else:
            # Re-raise other errors with more context
            logger.error(f"LiteLLM error for machine {machine_id}: {error_message}")
            raise HTTPException(
                status_code=500,
                detail=f"Error processing request: {error_message}"
            )


@router.get(
    "/machines/{machine_id}/v1/models",
    summary="List Machine's Supported Models",
    description="""Get the list of models supported by a specific machine.""",
)
async def machine_models(
    machine_id: str,
    db: DBSession,
    user: User = Depends(verify_user),
):
    # Cast machine_id to int
    try:
        machine_id_int = int(machine_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid machine ID")
    
    machine = await db.exec(select(Machine).where(Machine.id == machine_id_int))
    machine = machine.first()
    
    if not machine:
        raise HTTPException(status_code=404, detail="Machine not found")
    
    return {
        "object": "list",
        "data": [
            {"id": model, "object": "model"}
            for model in (machine.supported_models or [])
        ]
    }
