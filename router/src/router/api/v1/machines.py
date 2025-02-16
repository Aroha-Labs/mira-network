from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from src.router.core.security import verify_user, verify_machine
from src.router.core.types import User
from src.router.db.session import get_session
import time
from src.router.models.machines import Machine
from typing import Annotated
from src.router.utils.redis import redis_client, get_online_machines

router = APIRouter()

SessionDep = Annotated[Session, Depends(get_session)]


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
def check_liveness(network_ip: str, session: SessionDep):
    # Check if machine is in Redis liveness records
    for key in redis_client.scan_iter(match="liveness:*"):
        if redis_client.hget(key, "network_ip") == network_ip:
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
def check_liveness_by_id(machine_id: str):
    # Direct check in Redis using machine_id
    if redis_client.exists(f"liveness:{machine_id}"):
        return {"machine_id": machine_id, "status": "online"}

    return {"machine_id": machine_id, "status": "offline"}


@router.post(
    "/liveness/{network_ip}",
    summary="Update Machine Liveness",
    description="""Updates the liveness status of a machine.

### Path Parameters
- `machine_uid`: UUID of the machine to update

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
def set_liveness(
    network_ip: str,
    session: SessionDep,
    machine_auth: dict = Depends(verify_machine),
):
    # Verify the token is authorized for this machine
    authorized_ips = [m["network_ip"] for m in machine_auth["machines"]]
    if network_ip not in authorized_ips:
        raise HTTPException(
            status_code=403, detail="Token not authorized for this machine"
        )

    now = time.time()
    redis_client.setnx(f"liveness-start:{network_ip}", now)
    created_at = float(redis_client.get(f"liveness-start:{network_ip}"))
    ttl = int((now - created_at) + 12)
    redis_client.expire(f"liveness-start:{network_ip}", ttl)

    machine = session.exec(
        select(Machine).where(Machine.network_ip == network_ip)
    ).first()

    if not machine:
        raise HTTPException(status_code=404, detail="Machine not found")

    redis_client.hset(
        f"liveness:{machine.id}",
        mapping={
            "network_ip": network_ip,
            "timestamp": now,
        },
    )

    redis_client.expire(f"liveness:{machine.id}", 6)

    return {"network_ip": network_ip, "status": "online"}


@router.get(
    "/machines",
    summary="List All Machines",
    description="""Retrieves a list of all registered machines with their current status.
    By default, disabled machines are excluded. Only admins can request disabled machines.""",
)
def list_all_machines(
    session: SessionDep,
    include_disabled: bool = False,
    user: User = Depends(verify_user),
):
    if include_disabled and "admin" not in user.roles:
        raise HTTPException(
            status_code=403, detail="Only admins can view disabled machines"
        )

    query = select(Machine)
    if not include_disabled:
        query = query.where(Machine.disabled == False)  # noqa: E712

    machines = session.exec(query).all()
    online_machines = get_online_machines()

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
