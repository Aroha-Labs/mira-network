import os
import httpx


async def verify_turnstile(token: str) -> bool:
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://challenges.cloudflare.com/turnstile/v0/siteverify",
            data={"secret": os.getenv("TURNSTILE_SECRET_KEY"), "response": token},
        )
        result = resp.json()
        return result.get("success", False)
