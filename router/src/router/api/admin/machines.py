import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import select
from src.router.db.session import DBSession
from src.router.core.security import verify_admin
from src.router.core.types import User
from src.router.schemas.machine import RegisterMachineRequest, MachineAuthToken
from src.router.models.machines import Machine
from src.router.models.machine_tokens import MachineToken
import secrets
from datetime import datetime
from src.router.utils.redis import redis_client

router = APIRouter()


@router.post(
    "/machines/register",
    summary="Register a New Machine",
    description="Admin endpoint to register a new machine in the system.",
)
async def register_machine(
    request: RegisterMachineRequest,
    db: DBSession,
    user: User = Depends(verify_admin),
):
    existing_machine_res = await db.exec(
        select(Machine).where(Machine.network_ip == request.network_ip)
    )
    existing_machine = existing_machine_res.first()

    if existing_machine:
        return {
            "id": existing_machine.id,
            "network_ip": existing_machine.network_ip,
            "name": existing_machine.name,
            "description": existing_machine.description,
            "created_at": existing_machine.created_at.isoformat(),
            "disabled": existing_machine.disabled,
            "status": "registered",
            "message": "Machine already registered",
        }

    new_machine = Machine(
        network_ip=request.network_ip,
        name=request.name,
        description=request.description,
    )
    db.add(new_machine)
    await db.commit()
    await db.refresh(new_machine)

    await redis_client.set(f"network_ip:{new_machine.id}", new_machine.network_ip)

    return {
        "id": new_machine.id,
        "network_ip": new_machine.network_ip,
        "name": new_machine.name,
        "description": new_machine.description,
        "created_at": new_machine.created_at.isoformat(),
        "disabled": new_machine.disabled,
        "status": "registered",
        "message": "Machine registered successfully",
    }


@router.get(
    "/machines/{network_ip}",
    summary="Get Machine Details",
)
async def get_machine(
    network_ip: str,
    db: DBSession,
    user: User = Depends(verify_admin),
):
    machine_res = await db.exec(select(Machine).where(Machine.network_ip == network_ip))
    machine = machine_res.first()

    return machine


@router.put(
    "/machines/{network_ip}",
    summary="Update Machine Details",
)
async def update_machine(
    network_ip: str,
    request: RegisterMachineRequest,
    db: DBSession,
    user: User = Depends(verify_admin),
):
    machine_res = await db.exec(select(Machine).where(Machine.network_ip == network_ip))
    machine = machine_res.first()

    if not machine:
        raise HTTPException(status_code=404, detail="Machine not found")

    # If network IP changed, update Redis cache
    if machine.network_ip != request.network_ip:
        await redis_client.set(f"network_ip:{machine.id}", request.network_ip)

    machine.network_ip = request.network_ip
    machine.name = request.name
    machine.description = request.description
    machine.disabled = request.disabled
    machine.updated_at = datetime.utcnow()  # Add this line to update timestamp

    db.add(machine)
    await db.commit()
    await db.refresh(machine)

    return machine


@router.post("/machines/{network_ip}/auth-tokens")
async def create_auth_token(
    network_ip: str,
    token: MachineAuthToken,
    db: DBSession,
    user: User = Depends(verify_admin),
):
    machine_res = await db.exec(select(Machine).where(Machine.network_ip == network_ip))
    machine = machine_res.first()

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
        db.add(new_token)
        await db.commit()
        await db.refresh(new_token)
    except Exception as e:
        await db.rollback()
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
async def delete_auth_token(
    network_ip: str,
    api_token: str,  # updated parameter name
    db: DBSession,
    user: User = Depends(verify_admin),
):
    machine_res = await db.exec(select(Machine).where(Machine.network_ip == network_ip))
    machine = machine_res.first()

    if not machine:
        raise HTTPException(status_code=404, detail="Machine not found")

    token_res = await db.exec(
        select(MachineToken).where(
            MachineToken.machine_id == machine.id,
            MachineToken.api_token == api_token,  # updated field name
            MachineToken.deleted_at == None,  # noqa: E711
        )
    )
    token = token_res.first()

    if not token:
        raise HTTPException(status_code=404, detail="Token not found")

    # Soft delete the token
    token.deleted_at = datetime.utcnow()
    db.add(token)
    await db.commit()

    return None


@router.get(
    "/machines/{network_ip}/auth-tokens",
    summary="List Machine Tokens",
)
async def list_machine_tokens(
    network_ip: str,
    db: DBSession,
    user: User = Depends(verify_admin),
):
    machine_res = await db.exec(select(Machine).where(Machine.network_ip == network_ip))
    machine = machine_res.first()

    if not machine:
        raise HTTPException(status_code=404, detail="Machine not found")

    tokens_res = await db.exec(
        select(MachineToken).where(
            MachineToken.machine_id == machine.id,
            MachineToken.deleted_at == None,  # noqa: E711
        )
    )
    tokens = tokens_res.all()

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
