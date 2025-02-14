import random

from fastapi import HTTPException
from src.router.schemas.machine import MachineInfo
from src.router.utils.redis import get_online_machines, redis_client

PROXY_PORT = 34523


def get_random_machines(number_of_machines: int = 1):
    machine_ids = get_online_machines()
    if not machine_ids:
        raise HTTPException(status_code=404, detail="No online machines available")

    if number_of_machines > len(machine_ids):
        raise HTTPException(
            status_code=404,
            detail=f"Not enough online machines available, we have {len(machine_ids)} online machines",
        )

    random_machine_ids = random.sample(machine_ids, number_of_machines)

    # get machine ips
    network_ips = redis_client.mget(
        [f"network_ip:{machine_id}" for machine_id in random_machine_ids]
    )

    if len(random_machine_ids) != len(network_ips):
        raise HTTPException(status_code=404, detail="Machine not found")

    return [
        MachineInfo(id=machine_id, network_ip=network_ip.decode("utf-8"))
        for machine_id, network_ip in zip(random_machine_ids, network_ips)
    ]
