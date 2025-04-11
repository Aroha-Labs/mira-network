from fastapi import APIRouter, Depends, HTTPException, Response
import logging
from sqlmodel import select
from src.router.db.session import DBSession
from src.router.core.security import verify_user, verify_machine
from src.router.core.types import User
import time
from src.router.models.machines import Machine
from src.router.utils.redis import redis_client, get_online_machines
from src.router.utils.nr import track

router = APIRouter()


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
    
    # Verify the token is authorized for this machine
    authorized_ips = [m["network_ip"] for m in machine_auth["machines"]]
    if network_ip not in authorized_ips:
        raise HTTPException(
            status_code=403, detail="Token not authorized for this machine"
        )

    # First look up the machine to get its ID
    machine = await db.exec(select(Machine).where(Machine.network_ip == network_ip))
    machine = machine.first()

    if not machine:
        track("set_liveness_error", {
            "network_ip": network_ip,
            "error": "machine_not_found"
        })
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

    logging.debug(f"Updated liveness for machine {machine_id} (IP: {network_ip})")

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
    track("list_machines_request", {
        "user_id": str(user.id),
        "include_disabled": include_disabled,
        "is_admin": "admin" in user.roles
    })
    
    if include_disabled and "admin" not in user.roles:
        track("list_machines_error", {
            "user_id": str(user.id),
            "error": "permission_denied",
            "include_disabled": include_disabled
        })
        raise HTTPException(
            status_code=403, detail="Only admins can view disabled machines"
        )

    query = select(Machine)
    if not include_disabled:
        query = query.where(Machine.disabled == False)  # noqa: E712

    machines = await db.exec(query)
    machines = machines.all()

    online_machines = await get_online_machines()

    return [
        {
            "id": machine.id,
            "network_ip": machine.network_ip,
            "name": machine.name,
            "description": machine.description,
            "created_at": machine.created_at.isoformat(),
            "disabled": machine.disabled,
            "status": ("online" if str(machine.id) in online_machines else "offline"),
        }
        for machine in machines
    ]
