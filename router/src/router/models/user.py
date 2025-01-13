from sqlmodel import SQLModel, Field, Column
from typing import Optional, Dict, Any
from datetime import datetime
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy import func
import uuid


class UserCredits(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    user_id: str
    credits: float
    created_at: datetime = Field(default=func.now(), nullable=False)
    updated_at: datetime = Field(default=func.now(), nullable=False)


class UserCreditsHistory(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    user_id: str
    amount: float
    description: Optional[str] = None
    created_at: datetime = Field(default=func.now(), nullable=False)


class User(SQLModel, table=True):
    id: uuid.UUID = Field(
        default_factory=uuid.uuid4,
        sa_column=Column(UUID(as_uuid=True), primary_key=True),
    )
    user_id: str = Field(unique=True)
    email: str
    full_name: str
    avatar_url: Optional[str] = None
    provider: str
    meta: Dict[str, Any] = Field(sa_column=Column(JSONB))
    custom_claim: Optional[Dict[str, Any]] = Field(
        default=None, sa_column=Column(JSONB)
    )
    last_login_at: datetime = Field(default=func.now(), nullable=False)
    created_at: datetime = Field(default=func.now(), nullable=False)
    updated_at: datetime = Field(default=func.now(), nullable=False)
