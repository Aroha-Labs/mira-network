import redis

redis_client = redis.Redis(host="127.0.0.1", port=6379, db=0)


def get_online_machines() -> list[str]:
    return [
        key.decode("utf-8").split(":")[1]
        for key in redis_client.keys(pattern="liveness:*")
    ]
