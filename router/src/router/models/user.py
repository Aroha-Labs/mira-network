from sqlmodel import SQLModel, Field, Column, Index
from typing import Optional, Dict, Any, List
from datetime import datetime
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy import DateTime, func, text, Float
import uuid
from sqlalchemy.orm import Relationship
from .wallet import Wallet
from sqlmodel import Boolean


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
    user_id: str = Field(sa_column=Column(index=True, unique=True))
    email: Optional[str] = Field(index=True)  # Will be part of full-text search
    full_name: Optional[str] = Field(index=True)  # Will be part of full-text search
    avatar_url: Optional[str] = None
    provider: Optional[str]
    meta: Dict[str, Any] = Field(sa_column=Column(JSONB, default={}))
    custom_claim: Dict[str, Any] = Field(sa_column=Column(JSONB, default={}))
    credits: float = Field(
        default=0, sa_column=Column(Float, server_default="0", nullable=False)
    )
    last_login_at: Optional[datetime]
    created_at: Optional[datetime] = Field(
        sa_column=Column(
            DateTime(timezone=True), server_default=func.now(), nullable=True
        )
    )
    updated_at: Optional[datetime] = Field(
        sa_column=Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)
    )
    auto_credit: bool = Field(default=False, sa_column=Column(Boolean, default=False))

    class Config:
        table = True
        indexes = [
            Index(
                "ix_users_full_text_search",
                text("full_name gin_trgm_ops"),
                text("email gin_trgm_ops"),
                postgresql_using="gin",
            ),
            Index("ix_users_credits_user_id", "credits", "user_id"),
        ]
