from sqlalchemy import func
from sqlmodel import SQLModel, Field as SQLField
from datetime import datetime
import uuid


class Flows(SQLModel, table=True):
    id: int | None = SQLField(default=None, primary_key=True)
    system_prompt: str = SQLField(nullable=False)
    name: str = SQLField(nullable=False, unique=True)

    created_at: datetime = SQLField(default=func.now(), nullable=False)
    updated_at: datetime = SQLField(default=func.now(), nullable=False)
