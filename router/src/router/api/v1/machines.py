from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from src.router.core.security import verify_user
from src.router.core.types import User
from src.router.db.session import get_session
from src.router.utils.redis import redis_client
import time
from src.router.schemas.machine import RegisterMachineRequest, MachineAuthToken
from src.router.models.machines import Machine
from typing import Annotated
from src.router.utils.redis import redis_client, get_online_machines
import uuid
import secrets

router = APIRouter()

SessionDep = Annotated[Session, Depends(get_session)]


@router.post(
    "/machines/register",
    summary="Register a New Machine",
    description="""Registers a new machine in the system.

### Request Body
```json
{
    "network_ip": string,
    "name": string,
    "description": string | null
}
```

### Response Format
```json
{
    "machine_uid": string,
    "network_ip": string,
    "name": string,
    "description": string | null,
    "created_at": string (ISO 8601 datetime),
    "disabled": boolean,
    "status": "registered"
}
```

### Fields Description
- `machine_uid`: Automatically generated UUID for the machine
- `network_ip`: IP address of the machine
- `name`: Display name for the machine
- `description`: Optional description
- `created_at`: Timestamp of registration
- `disabled`: Whether the machine is disabled
- `status`: Always "registered" for new machines

### Error Responses
- `400 Bad Request`:
    ```json
    {
        "detail": "Machine already registered"
    }
    ```""",
    response_description="Returns the registered machine details",
    responses={
        200: {
            "description": "Successfully registered machine",
            "content": {
                "application/json": {
                    "example": {
                        "machine_uid": "550e8400-e29b-41d4-a716-446655440000",
                        "network_ip": "192.168.1.100",
                        "name": "Production Server 1",
                        "description": "Main production server",
                        "created_at": "2024-01-15T10:30:00Z",
                        "disabled": False,
                        "status": "registered",
                    }
                }
            },
        },
        400: {
            "description": "Machine already registered",
            "content": {
                "application/json": {
                    "example": {"detail": "Machine already registered"}
                }
            },
        },
    },
)
def register_machine(
    request: RegisterMachineRequest,
    session: SessionDep,
):
    # Generate machine_uid if not provided
    machine_uid = str(uuid.uuid4())

    existing_machine = session.exec(
        select(Machine).where(Machine.network_machine_uid == machine_uid)
    ).first()
    if existing_machine:
        raise HTTPException(status_code=400, detail="Machine already registered")

    new_machine = Machine(
        network_machine_uid=machine_uid,
        network_ip=request.network_ip,
        name=request.name,
        description=request.description,
    )
    session.add(new_machine)
    session.commit()
    session.refresh(new_machine)

    return {
        "machine_uid": machine_uid,
        "network_ip": request.network_ip,
        "name": request.name,
        "description": request.description,
        "created_at": new_machine.created_at.isoformat(),
        "disabled": new_machine.disabled,
        "status": "registered",
    }


@router.get(
    "/liveness/{machine_uid}",
    summary="Check Machine Liveness",
    description="""Checks if a specific machine is currently online and responding.

### Path Parameters
- `machine_uid`: UUID of the machine to check

### Response Format
```json
{
    "machine_uid": string,
    "status": "online" | "offline"
}
```

### Error Responses
- `404 Not Found`:
    ```json
    {
        "detail": "Machine not found"
    }
    ```

### Notes
- Status is determined by checking Redis cache
- "online" indicates the machine has recently sent a heartbeat
- "offline" indicates no recent heartbeat received""",
    response_description="Returns the machine's current status",
    responses={
        200: {
            "description": "Successfully retrieved machine status",
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
def check_liveness(machine_uid: str, session: SessionDep):
    machine = session.exec(
        select(Machine).where(Machine.network_machine_uid == machine_uid)
    ).first()
    if not machine:
        raise HTTPException(status_code=404, detail="Machine not found")

    status = redis_client.get(machine.id)
    if status:
        return {"machine_uid": machine_uid, "status": "online"}
    else:
        return {"machine_uid": machine_uid, "status": "offline"}


@router.post(
    "/liveness/{machine_uid}",
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
def set_liveness(machine_uid: str, session: SessionDep):
    now = time.time()
    redis_client.setnx(f"liveness-start:{machine_uid}", now)
    created_at = float(redis_client.get(f"liveness-start:{machine_uid}"))
    ttl = int((now - created_at) + 12)
    redis_client.expire(f"liveness-start:{machine_uid}", ttl)

    network_ip = redis_client.get(f"network_ip:{machine_uid}")
    if not network_ip:
        machine = session.exec(
            select(Machine).where(Machine.network_machine_uid == machine_uid)
        ).first()
        if not machine:
            raise HTTPException(status_code=404, detail="Machine not found")
        redis_client.set(f"network_ip:{machine_uid}", machine.network_ip)
        network_ip = machine.network_ip

    redis_client.hset(
        f"liveness:{machine_uid}",
        mapping={
            "network_ip": network_ip,
            "timestamp": now,
            "machine_uid": machine_uid,
        },
    )
    redis_client.expire(f"liveness:{machine_uid}", 6)

    return {"machine_uid": machine_uid, "status": "online"}


@router.get(
    "/machines",
    summary="List All Machines",
    description="""Retrieves a list of all registered machines with their current status.

### Authentication
- Requires a valid authentication token
- Token must be passed in the Authorization header

### Response Format
```json
[
    {
        "machine_uid": string,
        "network_ip": string,
        "name": string,
        "description": string | null,
        "created_at": string (ISO 8601 datetime),
        "disabled": boolean,
        "status": "online" | "offline",
        "last_seen": number | null
    }
]
```

### Fields Description
- `machine_uid`: Unique identifier for the machine
- `network_ip`: IP address of the machine
- `name`: Display name for the machine
- `description`: Optional description
- `created_at`: Registration timestamp
- `disabled`: Whether the machine is disabled
- `status`: Current online/offline status
- `last_seen`: Unix timestamp of last heartbeat (null if offline)

### Error Responses
- `401 Unauthorized`:
    ```json
    {
        "detail": "Could not validate credentials"
    }
    ```""",
    response_description="Returns an array of machine details",
    responses={
        200: {
            "description": "Successfully retrieved machines list",
            "content": {
                "application/json": {
                    "example": [
                        {
                            "machine_uid": "550e8400-e29b-41d4-a716-446655440000",
                            "network_ip": "192.168.1.100",
                            "name": "Production Server 1",
                            "description": "Main production server",
                            "created_at": "2024-01-15T10:30:00Z",
                            "disabled": False,
                            "status": "online",
                            "last_seen": 1705312200,
                        }
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
def list_all_machines(session: SessionDep, user: User = Depends(verify_user)):
    machines = session.exec(select(Machine)).all()
    online_machines = get_online_machines()

    return [
        {
            "machine_uid": machine.network_machine_uid,
            "network_ip": machine.network_ip,
            "name": machine.name,
            "description": machine.description,
            "created_at": machine.created_at.isoformat(),
            "disabled": machine.disabled,
            "auth_tokens": machine.auth_tokens,
            "status": (
                "online"
                if machine.network_machine_uid in online_machines
                else "offline"
            ),
            "last_seen": (
                redis_client.hget(
                    f"liveness:{machine.network_machine_uid}", "timestamp"
                )
                if machine.network_machine_uid in online_machines
                else None
            ),
        }
        for machine in machines
    ]


@router.get(
    "/machines/online",
    summary="List Online Machines",
    description="""Retrieves a list of currently online machines.

### Authentication
- Requires a valid authentication token
- Token must be passed in the Authorization header

### Response Format
```json
[
    {
        "machine_uid": string
    }
]
```

### Notes
- Only returns machines that have sent a heartbeat recently
- Empty array if no machines are online

### Error Responses
- `401 Unauthorized`:
    ```json
    {
        "detail": "Could not validate credentials"
    }
    ```""",
    response_description="Returns an array of online machine IDs",
    responses={
        200: {
            "description": "Successfully retrieved online machines",
            "content": {
                "application/json": {
                    "example": [{"machine_uid": "550e8400-e29b-41d4-a716-446655440000"}]
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
def list_online_machines(user: User = Depends(verify_user)):
    online_machines = get_online_machines()
    return [{"machine_uid": key} for key in online_machines]


@router.put(
    "/machines/{machine_uid}",
    summary="Update Machine Details",
    description="""Updates the details of an existing machine.

### Authentication
- Requires a valid authentication token
- Token must be passed in the Authorization header

### Path Parameters
- `machine_uid`: UUID of the machine to update

### Request Body
```json
{
    "network_ip": string,
    "name": string,
    "description": string | null
}
```

### Response Format
Returns the complete updated machine object.

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
        "detail": "Machine not found"
    }
    ```""",
    response_description="Returns the updated machine details",
    responses={
        200: {
            "description": "Successfully updated machine",
            "content": {
                "application/json": {
                    "example": {
                        "network_machine_uid": "550e8400-e29b-41d4-a716-446655440000",
                        "network_ip": "192.168.1.100",
                        "name": "Updated Server Name",
                        "description": "Updated description",
                        "created_at": "2024-01-15T10:30:00Z",
                        "disabled": False,
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
def update_machine(
    machine_uid: str,
    request: RegisterMachineRequest,
    session: SessionDep,
    user: User = Depends(verify_user),
):
    machine = session.exec(
        select(Machine).where(Machine.network_machine_uid == machine_uid)
    ).first()
    if not machine:
        raise HTTPException(status_code=404, detail="Machine not found")

    # Update machine fields
    machine.network_ip = request.network_ip
    machine.name = request.name
    machine.description = request.description

    session.add(machine)
    session.commit()
    session.refresh(machine)

    return machine


@router.post(
    "/machines/{machine_uid}/auth-tokens",
    summary="Create Auth Token",
    response_model=dict,
)
def create_auth_token(
    machine_uid: str,
    token: MachineAuthToken,
    session: SessionDep,
    user: User = Depends(verify_user),
):
    print(f"Received token creation request for machine {machine_uid}")
    print(f"Token data: {token.model_dump()}")

    machine = session.exec(
        select(Machine).where(Machine.network_machine_uid == machine_uid)
    ).first()
    if not machine:
        raise HTTPException(status_code=404, detail="Machine not found")

    # Initialize auth_tokens if it doesn't exist
    if machine.auth_tokens is None:
        machine.auth_tokens = {}

    token_id = secrets.token_urlsafe(16)

    # Create new token entry
    machine.auth_tokens = {
        **machine.auth_tokens,
        token_id: {"description": token.description},
    }

    try:
        session.add(machine)
        session.commit()
        session.refresh(machine)
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to save token: {str(e)}")

    return machine.model_dump()


@router.delete(
    "/machines/{machine_uid}/auth-tokens/{token_id}",
    summary="Delete Auth Token",
    status_code=204,
)
def delete_auth_token(
    machine_uid: str,
    token_id: str,
    session: SessionDep,
    user: User = Depends(verify_user),
):
    machine = session.exec(
        select(Machine).where(Machine.network_machine_uid == machine_uid)
    ).first()
    if not machine:
        raise HTTPException(status_code=404, detail="Machine not found")

    if token_id not in machine.auth_tokens:
        raise HTTPException(status_code=404, detail="Token not found")

    del machine.auth_tokens[token_id]

    session.add(machine)
    session.commit()

    return None
