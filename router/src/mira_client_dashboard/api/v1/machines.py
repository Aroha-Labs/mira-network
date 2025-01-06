from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from src.mira_client_dashboard.core.security import verify_user
from src.mira_client_dashboard.core.types import User
from src.mira_client_dashboard.db.session import get_session
from src.mira_client_dashboard.utils.redis import redis_client
import time
from src.mira_client_dashboard.schemas.machine import RegisterMachineRequest
from src.mira_client_dashboard.models.machines import Machine
from typing import Annotated
from src.mira_client_dashboard.utils.redis import redis_client, get_online_machines

router = APIRouter()

SessionDep = Annotated[Session, Depends(get_session)]


@router.post("/register/{machine_uid}")
def register_machine(
    machine_uid: str, request: RegisterMachineRequest, session: SessionDep
):
    existing_machine = session.exec(
        select(Machine).where(Machine.network_machine_uid == machine_uid)
    ).first()
    if existing_machine:
        raise HTTPException(status_code=400, detail="Machine already registered")

    new_machine = Machine(
        network_machine_uid=machine_uid,
        network_ip=request.network_ip,
    )
    session.add(new_machine)
    session.commit()
    session.refresh(new_machine)
    return {
        "machine_uid": machine_uid,
        "network_ip": request.network_ip,
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
            "status": (
                "online"
                if machine.network_machine_uid in online_machines
                else "offline"
            ),
        }
        for machine in machines
    ]


@router.get("/machines/online")
def list_online_machines(user: User = Depends(verify_user)):
    online_machines = get_online_machines()
    return [{"machine_uid": key} for key in online_machines]
