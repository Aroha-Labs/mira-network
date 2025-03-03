import os
import redis.asyncio as aioredis
import time
from async_lru import alru_cache

# Create connection pools
# redis_pool = redis.ConnectionPool(
#     host=os.getenv("REDIS_HOST"),
#     port=int(os.getenv("REDIS_PORT", 6379)),
#     username=os.getenv("REDIS_USERNAME"),
#     password=os.getenv("REDIS_PASSWORD"),
#     db=int(os.getenv("REDIS_DB", 0)),
#     decode_responses=True,
#     max_connections=200,
#     socket_timeout=2,
#     socket_connect_timeout=2,
#     retry_on_timeout=True,
#     health_check_interval=30,
# )

redis_pool = aioredis.ConnectionPool(
    host=os.getenv("REDIS_HOST"),
    port=int(os.getenv("REDIS_PORT", 6379)),
    username=os.getenv("REDIS_USERNAME"),
    password=os.getenv("REDIS_PASSWORD"),
    db=int(os.getenv("REDIS_DB", 0)),
    max_connections=200,
    socket_timeout=5,
    socket_connect_timeout=5,
    retry_on_timeout=True,
    health_check_interval=30,
)

# Use connection pools for client initialization
redis_client = aioredis.Redis(connection_pool=redis_pool)
# redis_client_async = aioredis.Redis(connection_pool=redis_pool_async)


async def get_online_machines() -> list[str]:
    """Get list of online machine IDs with caching using async_lru"""
    keys = await redis_client.keys(pattern="liveness:*")
    machine_ids = [key.decode().split(":")[1] for key in keys]
    return machine_ids


# async def get_online_machines_async() -> list[str]:
#     keys = await redis_client.keys(pattern="liveness:*")
#     return [key.decode().split(":")[1] for key in keys]


async def cleanup():
    # Clear caches
    get_online_machines.cache_clear()

    # Close Redis connections
    await redis_client.close()
    await redis_pool.disconnect()
