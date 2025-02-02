from pydantic import BaseModel, Field
from datetime import datetime
from uuid import UUID


class WalletCreate(BaseModel):
    address: str = Field(..., description="Wallet address")
    chain: str = Field(..., description="Blockchain network (e.g., ethereum, polygon)")


class WalletResponse(BaseModel):
    id: UUID
    address: str
    chain: str
    user_id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class WalletLoginRequest(BaseModel):
    address: str = Field(..., description="Wallet address to login with")
    signature: str = Field(..., description="Signed message for verification")


class WalletLoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    user_id: str
