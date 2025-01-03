from typing import List
import random

PROXY_PORT = 8001

def get_random_machines(count: int) -> List:
    from src.mira_client_dashboard.utils.redis import redis_client
    
    machines = redis_client.smembers("machines")
    if not machines:
        raise ValueError("No machines available")
    
    return random.sample(list(machines), min(count, len(machines)))