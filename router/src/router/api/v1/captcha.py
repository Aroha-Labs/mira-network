from fastapi import APIRouter, HTTPException
from src.router.schemas.captcha import CaptchaVerifyRequest, CaptchaVerifyResponse
from src.router.utils.redis import redis_client
import httpx
import os
from src.router.utils.nr import track

router = APIRouter()

TURNSTILE_SECRET_KEY = os.getenv("TURNSTILE_SECRET_KEY")
TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"
CAPTCHA_TTL = 24 * 60 * 60  # 24 hours in seconds


@router.post(
    "/verify",
    response_model=CaptchaVerifyResponse,
    summary="Verify Turnstile Captcha",
    description="Verifies a Turnstile captcha token and stores the verification status for 24 hours",
)
async def verify_captcha(request: CaptchaVerifyRequest):
    track("captcha_verify_request", {"user_id": request.user_id})

    if not TURNSTILE_SECRET_KEY:
        track("captcha_verify_error", {"error": "missing_secret_key"})
        raise HTTPException(
            status_code=500, detail="Turnstile secret key not configured"
        )

    # Check if user is already verified
    redis_key = f"captcha:verified:{request.user_id}"
    is_verified = await redis_client.get(redis_key)
    if is_verified:
        track("captcha_verify_cached", {"user_id": request.user_id})
        return CaptchaVerifyResponse(success=True, message="Already verified")

    # Verify with Turnstile
    async with httpx.AsyncClient() as client:
        response = await client.post(
            TURNSTILE_VERIFY_URL,
            data={"secret": TURNSTILE_SECRET_KEY, "response": request.token},
        )
        result = response.json()

        if not result.get("success", False):
            track(
                "captcha_verify_failed",
                {
                    "user_id": request.user_id,
                    "error": result.get("error-codes", ["unknown_error"]),
                },
            )
            raise HTTPException(status_code=400, detail="Captcha verification failed")

    # Store verification in Redis with TTL
    await redis_client.set(redis_key, "1", ex=CAPTCHA_TTL)

    track("captcha_verify_success", {"user_id": request.user_id})
    return CaptchaVerifyResponse(success=True)


@router.get(
    "/status/{user_id}",
    response_model=CaptchaVerifyResponse,
    summary="Check Captcha Verification Status",
    description="Checks if a user has a valid captcha verification",
)
async def check_verification(user_id: str):
    track("captcha_status_check", {"user_id": user_id})

    redis_key = f"captcha:verified:{user_id}"
    is_verified = await redis_client.get(redis_key)

    return CaptchaVerifyResponse(
        success=bool(is_verified), message="Verified" if is_verified else "Not verified"
    )
