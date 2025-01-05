from sqlmodel import SQLModel, Field, Column
from typing import Optional
from datetime import datetime
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy import func


class UserCustomClaim(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    user_id: str = Field(unique=True)
    claim: dict = Field(sa_column=Column(JSONB))
    deleted_at: Optional[datetime] = None
    created_at: datetime = Field(default=func.now(), nullable=False)


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
