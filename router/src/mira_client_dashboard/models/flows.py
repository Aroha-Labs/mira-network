from sqlmodel import SQLModel, Field as SQLField
from typing import Optional
import datetime
import uuid

class Flows(SQLModel, table=True):
    id: Optional[int] = SQLField(
        default=None,
        primary_key=True,
    )
    system_prompt: str = SQLField(nullable=False)
    name: str = SQLField(nullable=False, unique=True)

    # now as default
    created_at: str = SQLField(
        default=datetime.datetime.now(datetime.timezone.utc), nullable=False
    )
    updated_at: str = SQLField(
        default=datetime.datetime.now(datetime.timezone.utc), nullable=False
    )