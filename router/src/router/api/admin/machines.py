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
from src.router.utils.litellm import (
    add_machine_to_litellm,
    remove_machine_from_litellm,
    rollback_litellm_deployments,
    update_machine_in_litellm,
    LiteLLMError,
)
from src.router.utils.logger import logger

router = APIRouter()


@router.post(
    "/machines/register",
    summary="Register a New Machine",
    description="Admin endpoint to register a new machine in the system and add it to LiteLLM.",
)
async def register_machine(
    request: RegisterMachineRequest,
    db: DBSession,
    user: User = Depends(verify_admin),
):
    # Check if machine already exists
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

    # Create new machine object
    new_machine = Machine(
        network_ip=request.network_ip,
        name=request.name,
        description=request.description,
        traffic_weight=request.traffic_weight,
        supported_models=request.supported_models,
    )
    
    # Start transaction
    litellm_added = False
    redis_added = False
    
    try:
        # Step 1: Add to database (but don't commit yet)
        db.add(new_machine)
        await db.flush()  # Get the ID without committing
        
        # Step 2: Add to LiteLLM (if configured)
        try:
            await add_machine_to_litellm(
                machine_id=new_machine.id,
                machine_ip=new_machine.network_ip,
                machine_name=new_machine.name or f"machine-{new_machine.id}",
                traffic_weight=new_machine.traffic_weight,
                supported_models_list=new_machine.supported_models,
            )
            litellm_added = True
            logger.info(f"Machine {new_machine.id} added to LiteLLM")
        except LiteLLMError as e:
            # If LiteLLM is required, fail the registration
            logger.error(f"Failed to add machine to LiteLLM: {str(e)}")
            await db.rollback()
            raise HTTPException(
                status_code=500,
                detail=f"Failed to add machine to LiteLLM: {str(e)}"
            )
        except Exception as e:
            # For other errors, log but continue (LiteLLM might not be configured)
            logger.warning(f"LiteLLM integration error (non-critical): {str(e)}")
        
        # Step 3: Add to Redis
        try:
            await redis_client.set(f"network_ip:{new_machine.id}", new_machine.network_ip)
            redis_added = True
        except Exception as e:
            logger.error(f"Failed to add machine to Redis: {str(e)}")
            # Rollback LiteLLM if it was added
            if litellm_added:
                await rollback_litellm_deployments(new_machine.id)
            await db.rollback()
            raise HTTPException(
                status_code=500,
                detail=f"Failed to add machine to Redis: {str(e)}"
            )
        
        # Step 4: Commit database transaction
        await db.commit()
        await db.refresh(new_machine)
        
        return {
            "id": new_machine.id,
            "network_ip": new_machine.network_ip,
            "name": new_machine.name,
            "description": new_machine.description,
            "created_at": new_machine.created_at.isoformat(),
            "disabled": new_machine.disabled,
            "traffic_weight": new_machine.traffic_weight,
            "supported_models": new_machine.supported_models,
            "status": "registered",
            "message": "Machine registered successfully",
            "litellm_configured": litellm_added,
        }
        
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        # Rollback everything on any other error
        logger.error(f"Unexpected error during machine registration: {str(e)}")
        
        # Rollback database
        await db.rollback()
        
        # Rollback Redis if it was added
        if redis_added and new_machine.id:
            try:
                await redis_client.delete(f"network_ip:{new_machine.id}")
            except Exception as redis_err:
                logger.error(f"Failed to rollback Redis: {str(redis_err)}")
        
        # Rollback LiteLLM if it was added
        if litellm_added and new_machine.id:
            await rollback_litellm_deployments(new_machine.id)
        
        raise HTTPException(
            status_code=500,
            detail=f"Failed to register machine: {str(e)}"
        )


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
    description="Update machine details including enable/disable status. Syncs with LiteLLM when status changes.",
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

    # Track what changed for potential rollback
    old_network_ip = machine.network_ip
    old_disabled = machine.disabled
    old_traffic_weight = machine.traffic_weight
    old_supported_models = machine.supported_models
    redis_updated = False
    litellm_updated = False

    try:
        # Update Redis if network IP changed
        if machine.network_ip != request.network_ip:
            try:
                await redis_client.set(f"network_ip:{machine.id}", request.network_ip)
                redis_updated = True
            except Exception as e:
                logger.error(f"Failed to update Redis: {str(e)}")
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to update Redis: {str(e)}"
                )

        # Update LiteLLM if disabled status, traffic weight, or supported models changed
        # Use current values if not provided in request
        new_disabled = request.disabled if request.disabled is not None else machine.disabled
        new_traffic_weight = request.traffic_weight if request.traffic_weight is not None else machine.traffic_weight
        new_supported_models = request.supported_models if request.supported_models is not None else machine.supported_models
        
        if machine.disabled != new_disabled or machine.traffic_weight != new_traffic_weight or machine.supported_models != new_supported_models:
            try:
                await update_machine_in_litellm(
                    machine_id=machine.id,
                    machine_ip=request.network_ip,
                    machine_name=request.name or machine.name or f"machine-{machine.id}",
                    enabled=not new_disabled,  # LiteLLM uses enabled, we store disabled
                    traffic_weight=new_traffic_weight,
                    supported_models_list=new_supported_models,
                )
                litellm_updated = True
                logger.info(f"Machine {machine.id} updated in LiteLLM: {'disabled' if request.disabled else 'enabled'}, weight={request.traffic_weight}")
            except LiteLLMError as e:
                # Rollback Redis if it was updated
                if redis_updated:
                    try:
                        await redis_client.set(f"network_ip:{machine.id}", old_network_ip)
                    except Exception as redis_err:
                        logger.error(f"Failed to rollback Redis: {str(redis_err)}")
                
                logger.error(f"Failed to update LiteLLM: {str(e)}")
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to update LiteLLM: {str(e)}"
                )
            except Exception as e:
                # Log but continue for non-critical LiteLLM errors
                logger.warning(f"LiteLLM update error (non-critical): {str(e)}")

        # Update database - only update fields that are provided
        machine.network_ip = request.network_ip
        if request.name is not None:
            machine.name = request.name
        if request.description is not None:
            machine.description = request.description
        if request.disabled is not None:
            machine.disabled = request.disabled
        if request.traffic_weight is not None:
            machine.traffic_weight = request.traffic_weight
        # Only update supported_models if explicitly provided (not None)
        if request.supported_models is not None:
            machine.supported_models = request.supported_models
        machine.updated_at = datetime.utcnow()

        db.add(machine)
        await db.commit()
        await db.refresh(machine)

        return {
            "id": machine.id,
            "network_ip": machine.network_ip,
            "name": machine.name,
            "description": machine.description,
            "created_at": machine.created_at.isoformat(),
            "updated_at": machine.updated_at.isoformat(),
            "disabled": machine.disabled,
            "traffic_weight": machine.traffic_weight,
            "supported_models": machine.supported_models,
            "litellm_synced": litellm_updated,
        }

    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        logger.error(f"Unexpected error updating machine: {str(e)}")
        
        # Rollback Redis if it was updated
        if redis_updated:
            try:
                await redis_client.set(f"network_ip:{machine.id}", old_network_ip)
            except Exception as redis_err:
                logger.error(f"Failed to rollback Redis: {str(redis_err)}")
        
        # Rollback LiteLLM if it was updated
        if litellm_updated:
            try:
                # Restore previous state
                await update_machine_in_litellm(
                    machine_id=machine.id,
                    machine_ip=old_network_ip,
                    machine_name=machine.name or f"machine-{machine.id}",
                    enabled=not old_disabled,
                    traffic_weight=old_traffic_weight,
                    supported_models_list=old_supported_models,
                )
            except Exception as litellm_err:
                logger.error(f"Failed to rollback LiteLLM: {str(litellm_err)}")
        
        # Rollback database
        await db.rollback()
        
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update machine: {str(e)}"
        )


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


@router.delete(
    "/machines/{network_ip}",
    summary="Delete Machine",
    description="Delete a machine from the system. Also removes it from LiteLLM and cleans up all associated data.",
    status_code=204,
)
async def delete_machine(
    network_ip: str,
    db: DBSession,
    user: User = Depends(verify_admin),
):
    # Find the machine
    machine_res = await db.exec(select(Machine).where(Machine.network_ip == network_ip))
    machine = machine_res.first()

    if not machine:
        raise HTTPException(status_code=404, detail="Machine not found")

    machine_id = machine.id
    
    try:
        # Step 1: Remove from LiteLLM (if configured)
        try:
            removed_deployments = await remove_machine_from_litellm(machine_id)
            logger.info(f"Removed {len(removed_deployments)} deployments from LiteLLM for machine {machine_id}")
        except LiteLLMError as e:
            logger.error(f"Failed to remove machine from LiteLLM: {str(e)}")
            # Continue with deletion even if LiteLLM fails (it might be down)
        except Exception as e:
            logger.warning(f"LiteLLM removal error (non-critical): {str(e)}")

        # Step 2: Delete associated tokens (soft delete)
        tokens_res = await db.exec(
            select(MachineToken).where(
                MachineToken.machine_id == machine_id,
                MachineToken.deleted_at == None,  # noqa: E711
            )
        )
        tokens = tokens_res.all()
        
        for token in tokens:
            token.deleted_at = datetime.utcnow()
            db.add(token)
        
        logger.info(f"Soft-deleted {len(tokens)} tokens for machine {machine_id}")

        # Step 3: Remove from Redis
        try:
            await redis_client.delete(f"network_ip:{machine_id}")
            await redis_client.delete(f"machine_id:{network_ip}")
            await redis_client.delete(f"liveness:{machine_id}")
            logger.info(f"Removed Redis entries for machine {machine_id}")
        except Exception as e:
            logger.error(f"Failed to remove Redis entries: {str(e)}")
            # Continue even if Redis cleanup fails

        # Step 4: Delete the machine from database
        await db.delete(machine)
        await db.commit()
        
        logger.info(f"Successfully deleted machine {machine_id} ({network_ip})")
        
        return None  # 204 No Content
        
    except Exception as e:
        logger.error(f"Failed to delete machine: {str(e)}")
        await db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete machine: {str(e)}"
        )
