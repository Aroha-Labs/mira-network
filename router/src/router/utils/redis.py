import redis
import os
import redis.asyncio as aioredis

redis_client = redis.Redis(
    host=os.getenv("REDIS_HOST"),
    port=int(os.getenv("REDIS_PORT", 6379)),
    username=os.getenv("REDIS_USERNAME"),
    password=os.getenv("REDIS_PASSWORD"),
    db=int(os.getenv("REDIS_DB", 0)),
    decode_responses=True,
)

redis_client_async = aioredis.Redis(
    host=os.getenv("REDIS_HOST"),
    port=int(os.getenv("REDIS_PORT", 6379)),
    db=int(os.getenv("REDIS_DB", 0)),
)


def get_online_machines() -> list[str]:
    return [key.split(":")[1] for key in redis_client.keys(pattern="liveness:*")]


async def get_online_machines_async() -> list[str]:
    keys = await redis_client_async.keys(pattern="liveness:*")
    return [key.decode().split(":")[1] for key in keys]
