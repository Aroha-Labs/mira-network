from sqlmodel import SQLModel, Field, Column
from typing import Optional, Dict, Any
from datetime import datetime
from sqlalchemy import func
from sqlalchemy.dialects.postgresql import JSONB


class ApiToken(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    user_id: str
    token: str
    description: Optional[str] = None
    meta_data: Dict[str, Any] = Field(sa_column=Column(JSONB, default={}))
    deleted_at: Optional[datetime] = None
    created_at: datetime = Field(default=func.now(), nullable=False)
