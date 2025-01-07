from sqlmodel import SQLModel, Field
from typing import Optional
from datetime import datetime
from sqlalchemy import func


class ApiToken(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    user_id: str
    token: str
    description: Optional[str] = None
    deleted_at: Optional[datetime] = None
    created_at: datetime = Field(default=func.now(), nullable=False)
