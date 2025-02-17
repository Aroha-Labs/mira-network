import random
from typing import List

from fastapi import HTTPException
from src.router.schemas.machine import MachineInfo
from src.router.utils.redis import get_online_machines, redis_client
from sqlmodel import col, select
from src.router.models.machines import Machine
from src.router.db.session import get_session

PROXY_PORT = 34523


def get_random_machines(number_of_machines: int = 1) -> List[MachineInfo]:
    if number_of_machines < 1:
        raise HTTPException(
            status_code=422,  # Changed from 400 to 422 (Unprocessable Entity) for invalid input
            detail="Number of machines must be greater than 0",
        )

    machine_ids = get_online_machines()
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
    network_ips = redis_client.mget(redis_keys)

    machines: List[MachineInfo] = []
    missing_ids: List[str] = []

    # Single pass through IPs
    for machine_id, ip in zip(random_machine_ids, network_ips):
        if not ip:
            missing_ids.append(machine_id)
            continue

        machines.append(MachineInfo(id=machine_id, network_ip=ip))

    # Handle missing IPs if any
    if missing_ids:
        db = next(get_session())
        db_machines = db.exec(
            select(Machine).where(col(Machine.id).in_(missing_ids))
        ).all()

        if len(db_machines) != len(missing_ids):
            raise HTTPException(
                status_code=404,
                detail="Some machines exist in Redis but not in database",
            )

        with redis_client.pipeline() as pipe:
            for machine in db_machines:
                str_id = str(machine.id)
                pipe.set(f"network_ip:{str_id}", machine.network_ip)
                machines.append(MachineInfo(id=str_id, network_ip=machine.network_ip))
            pipe.execute()

    return machines
