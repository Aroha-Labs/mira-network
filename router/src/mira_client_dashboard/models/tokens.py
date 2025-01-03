from sqlmodel import SQLModel, Field
from typing import Optional
from datetime import datetime

class ApiToken(SQLModel, table=True):
    id: Optional[str] = Field(default=None, primary_key=True)
    user_id: str
    token: str
    description: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    deleted_at: Optional[datetime] = None