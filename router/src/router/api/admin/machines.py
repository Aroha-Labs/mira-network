import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from src.router.core.security import verify_admin
from src.router.core.types import User
from src.router.db.session import get_session
from src.router.schemas.machine import RegisterMachineRequest, MachineAuthToken
from src.router.models.machines import Machine
from src.router.models.machine_tokens import MachineToken
from typing import Annotated
import secrets
from datetime import datetime
from src.router.utils.redis import redis_client

router = APIRouter()

SessionDep = Annotated[Session, Depends(get_session)]


@router.post(
    "/machines/register",
    summary="Register a New Machine",
    description="Admin endpoint to register a new machine in the system.",
)
def register_machine(
    request: RegisterMachineRequest,
    session: SessionDep,
    user: User = Depends(verify_admin),
):
    existing_machine = session.exec(
        select(Machine).where(Machine.network_ip == request.network_ip)
    ).first()
    if existing_machine:
        raise HTTPException(status_code=400, detail="Machine already registered")

    new_machine = Machine(
        network_ip=request.network_ip,
        name=request.name,
        description=request.description,
    )
    session.add(new_machine)
    session.commit()
    session.refresh(new_machine)

    redis_client.set(f"network_ip:{new_machine.id}", new_machine.network_ip)

    return {
        "network_ip": request.network_ip,
        "name": request.name,
        "description": request.description,
        "created_at": new_machine.created_at.isoformat(),
        "disabled": new_machine.disabled,
        "status": "registered",
    }


@router.put(
    "/machines/{network_ip}",
    summary="Update Machine Details",
)
def update_machine(
    network_ip: str,
    request: RegisterMachineRequest,
    session: SessionDep,
    user: User = Depends(verify_admin),
):
    machine = session.exec(
        select(Machine).where(Machine.network_ip == network_ip)
    ).first()
    if not machine:
        raise HTTPException(status_code=404, detail="Machine not found")

    # If network IP changed, update Redis cache
    if machine.network_ip != request.network_ip:
        redis_client.set(f"network_ip:{machine.id}", request.network_ip)

    machine.network_ip = request.network_ip
    machine.name = request.name
    machine.description = request.description
    machine.disabled = request.disabled
    machine.updated_at = datetime.utcnow()  # Add this line to update timestamp

    session.add(machine)
    session.commit()
    session.refresh(machine)

    return machine


@router.post("/machines/{network_ip}/auth-tokens")
def create_auth_token(
    network_ip: str,
    token: MachineAuthToken,
    session: SessionDep,
    user: User = Depends(verify_admin),
):
    machine = session.exec(
        select(Machine).where(Machine.network_ip == network_ip)
    ).first()
    if not machine:
        raise HTTPException(status_code=404, detail="Machine not found")

    api_token = "mk-mira-" + secrets.token_urlsafe(16)
    new_token = MachineToken(
        id=uuid.uuid4(),
        machine_id=machine.id,
        api_token=api_token,
        description=token.description or None,
        created_at=datetime.utcnow(),  # Explicitly set creation time
    )

    try:
        session.add(new_token)
        session.commit()
        session.refresh(new_token)
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to save token: {str(e)}")

    return {
        "id": str(new_token.id),
        "machine_id": machine.id,
        "api_token": api_token,
        "description": token.description,
        "created_at": new_token.created_at,
    }


@router.delete(
    "/machines/{network_ip}/auth-tokens/{api_token}",  # updated path parameter
    summary="Delete Auth Token",
    status_code=204,
)
def delete_auth_token(
    network_ip: str,
    api_token: str,  # updated parameter name
    session: SessionDep,
    user: User = Depends(verify_admin),
):
    machine = session.exec(
        select(Machine).where(Machine.network_ip == network_ip)
    ).first()
    if not machine:
        raise HTTPException(status_code=404, detail="Machine not found")

    token = session.exec(
        select(MachineToken).where(
            MachineToken.machine_id == machine.id,
            MachineToken.api_token == api_token,  # updated field name
            MachineToken.deleted_at == None,  # noqa: E711
        )
    ).first()
    if not token:
        raise HTTPException(status_code=404, detail="Token not found")

    # Soft delete the token
    token.deleted_at = datetime.utcnow()
    session.add(token)
    session.commit()

    return None


@router.get(
    "/machines/{network_ip}/auth-tokens",
    summary="List Machine Tokens",
)
def list_machine_tokens(
    network_ip: str,
    session: SessionDep,
    user: User = Depends(verify_admin),
):
    machine = session.exec(
        select(Machine).where(Machine.network_ip == network_ip)
    ).first()
    if not machine:
        raise HTTPException(status_code=404, detail="Machine not found")

    tokens = session.exec(
        select(MachineToken).where(
            MachineToken.machine_id == machine.id,
            MachineToken.deleted_at == None,  # noqa: E711
        )
    ).all()

    return [
        {
            "id": str(token.id),  # Added id to response
            "api_token": token.api_token,
            "description": token.description,
            "created_at": token.created_at,
            "machine_id": token.machine_id,
        }
        for token in tokens
    ]
