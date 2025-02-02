from datetime import datetime
from sqlalchemy import func, UUID
from sqlmodel import SQLModel, Field
import uuid

class Wallet(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    address: str = Field(unique=True, index=True, nullable=False)
    chain: str = Field(nullable=False)  # e.g., "ethereum", "polygon", etc.
    user_id: str
    created_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)
    updated_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)

