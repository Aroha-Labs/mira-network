from typing import Dict, Any
from sqlalchemy import Column, func
from sqlmodel import SQLModel, Field
from sqlalchemy.dialects.postgresql import JSONB, BOOLEAN
from datetime import datetime


class Machine(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    network_machine_uid: str = Field(index=True, unique=True)
    name: str | None = Field(index=True)
    description: str | None = Field(index=True)
    auth_tokens: Dict[str, Any] = Field(
        sa_column=Column(JSONB, server_default="{}", nullable=False),
        default_factory=dict,
    )
    disabled: bool = Field(
        sa_column=Column(BOOLEAN, server_default="False", nullable=False)
    )
    network_ip: str = Field(index=True, unique=True)
    created_at: datetime = Field(default=func.now(), nullable=False)
    updated_at: datetime = Field(default=func.now(), nullable=False)
