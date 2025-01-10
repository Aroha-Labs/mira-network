from sqlmodel import SQLModel, Field, Column
from typing import Optional
from datetime import datetime
from sqlalchemy import func
from sqlalchemy.dialects.postgresql import JSONB


class SystemSettings(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(unique=True)
    value: dict = Field(sa_column=Column(JSONB))
    description: Optional[str] = None
    created_at: datetime = Field(default=func.now(), nullable=False)
    updated_at: datetime = Field(default=func.now(), nullable=False)
