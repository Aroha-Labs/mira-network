import os
import redis.asyncio as aioredis
import json

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

use_ssl = os.getenv("REDIS_SSL", "False").lower() == "true"


if use_ssl:
    redis_url = f"rediss://{os.getenv('REDIS_HOST')}:{os.getenv('REDIS_PORT')}"
else:
    redis_url = f"redis://{os.getenv('REDIS_USERNAME')}:{os.getenv('REDIS_PASSWORD')}@{os.getenv('REDIS_HOST')}:{os.getenv('REDIS_PORT')}/{os.getenv('REDIS_DB')}"

redis_pool = aioredis.ConnectionPool.from_url(
    url=redis_url,
    max_connections=200,
    socket_timeout=5,
    socket_connect_timeout=5,
    retry_on_timeout=True,
    health_check_interval=30,
)

# Use connection pools for client initialization
redis_client = aioredis.Redis(connection_pool=redis_pool)
# redis_client_async = aioredis.Redis(connection_pool=redis_pool_async)

SETTINGS_CACHE_KEY = "system_settings:{name}"
SETTINGS_CACHE_TTL = 3600  # 1 hour


async def get_cached_setting(name: str) -> dict | None:
    """Get setting from Redis cache"""
    cached = await redis_client.get(SETTINGS_CACHE_KEY.format(name=name))
    return json.loads(cached) if cached else None


async def set_cached_setting(name: str, value: dict):
    """Set setting in Redis cache"""
    await redis_client.set(
        SETTINGS_CACHE_KEY.format(name=name), json.dumps(value), ex=SETTINGS_CACHE_TTL
    )


async def delete_cached_setting(name: str):
    """Delete setting from Redis cache"""
    await redis_client.delete(SETTINGS_CACHE_KEY.format(name=name))


async def get_online_machines() -> list[str]:
    """Get list of online machine IDs with caching using async_lru"""
    keys = await redis_client.keys(pattern="liveness:*")
    machine_ids = [key.decode().split(":")[1] for key in keys]
    return machine_ids


# async def get_online_machines_async() -> list[str]:
#     keys = await redis_client.keys(pattern="liveness:*")
#     return [key.decode().split(":")[1] for key in keys]


async def cleanup():
    # Close Redis connections
    await redis_client.close()
    await redis_pool.disconnect()
