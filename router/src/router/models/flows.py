from typing import List
from sqlalchemy import func, JSON
from sqlmodel import SQLModel, Field as SQLField
from datetime import datetime


class Flows(SQLModel, table=True):
    id: int | None = SQLField(default=None, primary_key=True)
    system_prompt: str = SQLField(nullable=False)
    name: str = SQLField(nullable=False, unique=False)
    variables: List[str] = SQLField(sa_type=JSON, nullable=True)
    created_at: datetime = SQLField(default=func.now(), nullable=False)
    updated_at: datetime = SQLField(default=func.now(), nullable=False)
