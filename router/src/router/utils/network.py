import random
from typing import List

from fastapi import HTTPException
from src.router.schemas.machine import MachineInfo
from src.router.utils.redis import get_online_machines, redis_client
from sqlmodel import col, select
from src.router.models.machines import Machine
from sqlmodel.ext.asyncio.session import AsyncSession

PROXY_PORT = 34523


async def get_random_machines(
    db: AsyncSession,
    number_of_machines: int = 1,
):
    if number_of_machines < 1:
        raise HTTPException(
            status_code=422,  # Changed from 400 to 422 (Unprocessable Entity) for invalid input
            detail="Number of machines must be greater than 0",
        )

    machine_ids = await get_online_machines()
    if not machine_ids:
        raise HTTPException(
            status_code=503,  # Changed from 404 to 503 (Service Unavailable) as this is a capacity issue
            detail="No online machines available",
        )

    if number_of_machines > len(machine_ids):
        raise HTTPException(
            status_code=503,  # Changed from 404 to 503 (Service Unavailable) as this is a capacity issue
            detail=f"Not enough online machines. Requested: {number_of_machines}, Available: {len(machine_ids)}",
        )

    random_machine_ids = random.sample(machine_ids, number_of_machines)
    redis_keys = [f"network_ip:{mid}" for mid in random_machine_ids]
    network_ips = await redis_client.mget(redis_keys)

    machines: List[MachineInfo] = []
    missing_ids: List[str] = []

    # Single pass through IPs
    for machine_id, ip in zip(random_machine_ids, network_ips):
        if not ip:
            missing_ids.append(machine_id)
            continue

        machines.append(MachineInfo(id=int(machine_id), network_ip=ip))
    # Handle missing IPs if any
    if missing_ids:
        # Convert string IDs to integers before the database query
        missing_ids_int = [int(mid) for mid in missing_ids]
        db_machines = await db.exec(
            select(Machine).where(col(Machine.id).in_(missing_ids_int))
        )

        db_machines = db_machines.all()

        if len(db_machines) != len(missing_ids):
            raise HTTPException(
                status_code=404,
                detail="Some machines exist in Redis but not in database",
            )

        async with redis_client.pipeline() as pipe:
            for machine in db_machines:
                str_id = str(machine.id)
                await pipe.set(f"network_ip:{str_id}", machine.network_ip)
                machines.append(
                    MachineInfo(id=int(str_id), network_ip=machine.network_ip)
                )
            await pipe.execute()

    return machines
