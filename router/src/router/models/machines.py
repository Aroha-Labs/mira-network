from sqlalchemy import Column, func, Float, JSON
from sqlmodel import SQLModel, Field
from sqlalchemy.dialects.postgresql import BOOLEAN
from datetime import datetime
from typing import List, Optional


class Machine(SQLModel, table=True):
    """
    Represents a Machine entity in the database.

    Attributes:
        id (int | None): The primary key of the machine. Defaults to None.
        name (str | None): The name of the machine. Indexed for faster querying.
        description (str | None): A description of the machine. Indexed for faster querying.
        disabled (bool): Indicates whether the machine is disabled. Defaults to False.
        network_ip (str): The network IP address of the machine. Indexed and unique.
        traffic_weight (float): Weight for load balancing (0.0-1.0). Defaults to 0.5 (50% traffic).
        created_at (datetime): The timestamp when the machine was created. Defaults to the current time.
        updated_at (datetime): The timestamp when the machine was last updated. Defaults to the current time.
    """

    id: int | None = Field(default=None, primary_key=True)
    name: str | None = Field(index=True)
    description: str | None = Field(index=True)
    disabled: bool = Field(
        sa_column=Column(BOOLEAN, server_default="False", nullable=False)
    )
    network_ip: str = Field(index=True, unique=True)
    traffic_weight: float = Field(
        default=0.5,
        sa_column=Column(Float, server_default="0.5", nullable=False),
        ge=0.0,
        le=1.0,
        description="Load balancing weight (0.0-1.0, where 0.5 = 50% traffic)"
    )
    supported_models: Optional[List[str]] = Field(
        default=None,
        sa_column=Column(JSON, nullable=True),
        description="List of model names this machine supports. If None, supports all models."
    )
    created_at: datetime = Field(default=func.now(), nullable=False)
    updated_at: datetime = Field(default=func.now(), nullable=False)
