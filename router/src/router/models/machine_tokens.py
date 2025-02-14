from sqlmodel import SQLModel, Field
from sqlalchemy import Column, DateTime, func
from datetime import datetime
import uuid
from typing import Optional


class MachineToken(SQLModel, table=True):
    """
    Represents a Machine authentication token in the database.
    """

    id: uuid.UUID = Field(
        default_factory=uuid.uuid4,
        primary_key=True,
        nullable=False,
    )
    machine_id: int = Field(index=True)
    api_token: str = Field(unique=True, index=True)
    description: Optional[str] = None
    created_at: datetime = Field(
        sa_column=Column(
            DateTime(timezone=True),
            server_default=func.now(),
            nullable=False,
        ),
    )
    deleted_at: Optional[datetime] = None
