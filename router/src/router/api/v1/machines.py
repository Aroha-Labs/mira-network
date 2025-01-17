from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from src.router.core.security import verify_user
from src.router.core.types import User
from src.router.db.session import get_session
from src.router.utils.redis import redis_client
import time
from src.router.schemas.machine import RegisterMachineRequest
from src.router.models.machines import Machine
from typing import Annotated
from src.router.utils.redis import redis_client, get_online_machines
import uuid

router = APIRouter()

SessionDep = Annotated[Session, Depends(get_session)]


@router.post("/machines/register")
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


@router.get("/liveness/{machine_uid}")
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


@router.post("/liveness/{machine_uid}")
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


@router.get("/machines")
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


@router.get("/machines/online")
def list_online_machines(user: User = Depends(verify_user)):
    online_machines = get_online_machines()
    return [{"machine_uid": key} for key in online_machines]


@router.put("/machines/{machine_uid}")
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
