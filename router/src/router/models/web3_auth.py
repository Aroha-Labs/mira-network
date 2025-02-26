from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class WalletSignRequest(BaseModel):
    wallet_address: str = Field(..., description="Ethereum wallet address")
    signature: str = Field(..., description="Signed message")
    nonce: str = Field(..., description="Nonce used for signing")
    
class AuthChallengeResponse(BaseModel):
    message: str = Field(..., description="Message to be signed")
    nonce: str = Field(..., description="Nonce to be used in signing")
    expiration: datetime = Field(..., description="Challenge expiration timestamp")

class Web3Profile(BaseModel):
    wallet_address: str = Field(..., description="Ethereum wallet address")
    last_signed_in: Optional[datetime] = Field(default=None)
    is_primary_wallet: bool = Field(default=False)

class Web3AuthResponse(BaseModel):
    access_token: str = Field(..., description="Supabase access token")
    refresh_token: str = Field(..., description="Supabase refresh token")
    wallet_address: str = Field(..., description="Authenticated wallet address")
    user_id: str = Field(..., description="Supabase user ID") 