from pydantic import BaseModel


class CaptchaVerifyRequest(BaseModel):
    token: str
    user_id: str  # Supabase user ID


class CaptchaVerifyResponse(BaseModel):
    success: bool
    message: str = "Verification successful"
