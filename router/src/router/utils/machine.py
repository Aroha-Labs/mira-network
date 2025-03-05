from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from src.router.models.machines import Machine
import logging
from src.router.utils.redis import redis_client

logger = logging.getLogger(__name__)


async def get_machine_id(machine_ip: str, db: AsyncSession) -> str:
    """
    Get machine ID from Redis cache or database.

    Args:
        machine_ip: IP address of the machine
        db: Database session

    Returns:
        str: Machine ID

    Raises:
        ValueError: If machine is not found in database
    """
    # Try to get from Redis first
    redis_key = f"machine_id:{machine_ip}"
    cached_id = await redis_client.get(redis_key)

    if cached_id:
        # Decode bytes to string if found in Redis
        machine_id = cached_id.decode("utf-8")
        logger.debug(f"Machine ID {machine_id} found in cache for IP {machine_ip}")
        return machine_id

    # Fallback to database lookup
    logger.debug(f"Cache miss for machine IP {machine_ip}, querying database")
    machine = await db.exec(select(Machine).where(Machine.network_ip == machine_ip))
    machine = machine.one_or_none()

    if not machine:
        raise ValueError(f"Machine with IP {machine_ip} not found in database")

    # Cache the result in Redis
    await redis_client.set(redis_key, str(machine.id), ex=3600)  # Cache for 1 hour
    logger.debug(f"Cached machine ID {machine.id} for IP {machine_ip}")

    return str(machine.id)
