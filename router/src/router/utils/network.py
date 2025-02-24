import random
from typing import List, Dict, Optional
import time
import asyncio
import itertools

from fastapi import HTTPException
from src.router.schemas.machine import MachineInfo
from src.router.utils.redis import get_online_machines, redis_client
from sqlmodel import col, select
from src.router.models.machines import Machine
from sqlmodel.ext.asyncio.session import AsyncSession
from src.router.utils.logger import logger

from async_lru import alru_cache

PROXY_PORT = 34523

# Create a global counter for round-robin selection
_machine_counter = itertools.cycle(range(1000000))  # Large enough cycle


# Cache for machines that doesn't depend on db session
@alru_cache(maxsize=1, ttl=3600)  # Cache for 1 hour
async def _get_cached_machine_list():
    """Internal function to cache machine list without db dependency"""
    logger.info("Cache miss for machines - fetching from Redis")

    # Get all online machine IDs
    machine_ids = await get_online_machines()
    if not machine_ids:
        raise HTTPException(
            status_code=503,
            detail="No online machines available",
        )

    # Get all network IPs in a single Redis operation
    redis_keys = [f"network_ip:{mid}" for mid in machine_ids]
    network_ips = await redis_client.mget(redis_keys)

    # Build the machine list
    machines: List[MachineInfo] = []
    missing_ids: List[str] = []

    for machine_id, ip in zip(machine_ids, network_ips):
        if ip:
            machines.append(
                MachineInfo(
                    id=int(machine_id),
                    network_ip=ip.decode() if isinstance(ip, bytes) else ip,
                )
            )
        else:
            missing_ids.append(machine_id)

    logger.info(f"Fetched {len(machines)} machines from Redis")
    return machines, missing_ids


async def get_cached_machines(db: AsyncSession) -> List[MachineInfo]:
    """Get all available machines with caching using async_lru"""
    # Try to get machines from cache first
    try:
        machines, missing_ids = await _get_cached_machine_list()
        logger.info(f"Machine cache info: {_get_cached_machine_list.cache_info()}")
    except Exception as e:
        logger.error(f"Error getting cached machines: {str(e)}")
        # Clear cache and retry
        _get_cached_machine_list.cache_clear()
        machines, missing_ids = await _get_cached_machine_list()

    # Only query DB for missing IPs if needed
    if missing_ids and len(missing_ids) > 0:
        logger.info(f"Fetching {len(missing_ids)} missing machines from DB")
        missing_ids_int = [int(mid) for mid in missing_ids]
        db_machines = await db.exec(
            select(Machine).where(col(Machine.id).in_(missing_ids_int))
        )
        db_machines = db_machines.all()

        # Update Redis and add to machines list
        async with redis_client.pipeline() as pipe:
            for machine in db_machines:
                if machine.id is not None:  # Handle None case
                    str_id = str(machine.id)
                    machine_id = int(machine.id)
                    await pipe.set(f"network_ip:{str_id}", machine.network_ip)
                    machines.append(
                        MachineInfo(id=machine_id, network_ip=machine.network_ip)
                    )
            await pipe.execute()

        # Clear cache to update with new Redis values
        _get_cached_machine_list.cache_clear()

    return machines


async def get_round_robin_machines(
    db: AsyncSession,
    number_of_machines: int = 1,
):
    """Get machines using round-robin selection for better load balancing"""
    if number_of_machines < 1:
        raise HTTPException(
            status_code=422,
            detail="Number of machines must be greater than 0",
        )

    # Get machines with caching
    try:
        machines = await get_cached_machines(db)
        logger.info(f"Machine cache info: {_get_cached_machine_list.cache_info()}")
    except Exception as e:
        logger.error(f"Error getting cached machines: {str(e)}")
        # Try to clear cache and retry once
        _get_cached_machine_list.cache_clear()
        try:
            machines = await get_cached_machines(db)
        except Exception as retry_error:
            logger.error(f"Retry failed: {str(retry_error)}")
            raise HTTPException(
                status_code=503,
                detail="Service temporarily unavailable. No machines available.",
            )

    # Check if we have enough machines
    if number_of_machines > len(machines):
        raise HTTPException(
            status_code=503,
            detail=f"Not enough online machines. Requested: {number_of_machines}, Available: {len(machines)}",
        )

    # Sort machines by ID for consistent ordering
    machines.sort(key=lambda m: m.id)

    # Use round-robin selection
    start_idx = next(_machine_counter) % len(machines)
    selected_machines = []

    # Select machines in round-robin fashion
    for i in range(number_of_machines):
        idx = (start_idx + i) % len(machines)
        selected_machines.append(machines[idx])
        logger.info(
            f"Round-robin selected machine {machines[idx].id} at {machines[idx].network_ip}"
        )

    return selected_machines


# Keep the random selection function for backward compatibility
async def get_random_machines(
    db: AsyncSession,
    number_of_machines: int = 1,
):
    """Get random machines using async_lru caching (legacy function)"""
    # For backward compatibility, now just calls the round-robin function
    return await get_round_robin_machines(db, number_of_machines)
