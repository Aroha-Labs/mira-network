from sqlalchemy import func
from sqlmodel import SQLModel, Field as SQLField
from datetime import datetime


class Machine(SQLModel, table=True):
    id: int | None = SQLField(default=None, primary_key=True)
    network_machine_uid: str = SQLField(index=True)
    network_ip: str = SQLField(index=True)
    created_at: datetime = SQLField(default=func.now(), nullable=False)
    updated_at: datetime = SQLField(default=func.now(), nullable=False)
