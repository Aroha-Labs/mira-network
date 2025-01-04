from sqlmodel import SQLModel, Field, Column
from typing import Optional
from datetime import datetime
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy import func


class ApiToken(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    user_id: str
    token: str
    description: Optional[str] = None
    deleted_at: Optional[datetime] = None
    created_at: datetime = Field(default=func.now(), nullable=False)


class UserCustomClaim(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    user_id: str = Field(unique=True)
    claim: dict = Field(sa_column=Column(JSONB))
    deleted_at: Optional[datetime] = None
    created_at: datetime = Field(default=func.now(), nullable=False)
