from fastapi import FastAPI
import logging
import asyncio
import httpx
from .core.config import ROUTER_BASE_URL, MACHINE_IP
from .api.v1 import chat, eval, models, health

app = FastAPI()

# Configure logging
logging.basicConfig(level=logging.INFO)

# Include routers
app.include_router(health.router, tags=["health"])
app.include_router(chat.router, prefix="/v1", tags=["chat"])
app.include_router(eval.router, prefix="/v1", tags=["eval"])
app.include_router(models.router, prefix="/v1", tags=["models"])


async def update_liveness(machine_ip: str):
    url = f"{ROUTER_BASE_URL}/liveness/{machine_ip}"
    while True:
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(url)
                response.raise_for_status()
                logging.info(f"Liveness check successful for {machine_ip}")
            except httpx.HTTPStatusError as exc:
                logging.error(
                    f"HTTP error occurred: {exc.response.status_code} - {exc.response.text}"
                )
            except Exception as exc:
                logging.error(f"An error occurred: {exc}")
        await asyncio.sleep(3)


@app.on_event("startup")
async def startup_event():
    asyncio.create_task(update_liveness(MACHINE_IP)) 