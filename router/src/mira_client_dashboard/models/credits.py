from sqlmodel import SQLModel, Field
from typing import Optional
from datetime import datetime

class UserCredits(SQLModel, table=True):
    id: Optional[str] = Field(default=None, primary_key=True)
    user_id: str
    credits: float
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class UserCreditsHistory(SQLModel, table=True):
    id: Optional[str] = Field(default=None, primary_key=True)
    user_id: str
    amount: float
    description: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)