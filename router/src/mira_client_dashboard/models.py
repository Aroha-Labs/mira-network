from typing import Optional
from sqlmodel import SQLModel, Field as SQLField
import datetime


class Machine(SQLModel, table=True):
    id: int = SQLField(primary_key=True)
    network_machine_uid: str = SQLField(index=True)
    network_ip: str = SQLField(index=True)

    # now as default
    created_at: str = SQLField(
        default=datetime.datetime.now(datetime.timezone.utc), nullable=False
    )
    updated_at: str = SQLField(
        default=datetime.datetime.now(datetime.timezone.utc), nullable=False
    )


class Flows(SQLModel, table=True):
    id: int = SQLField(primary_key=True)
    system_prompt: str = SQLField(nullable=False)
    name: str = SQLField(nullable=False, unique=True)

    # now as default
    created_at: str = SQLField(
        default=datetime.datetime.now(datetime.timezone.utc), nullable=False
    )
    updated_at: str = SQLField(
        default=datetime.datetime.now(datetime.timezone.utc), nullable=False
    )


class ApiLogs(SQLModel, table=True):
    id: int = SQLField(primary_key=True)
    user_id: str = SQLField(nullable=False)
    payload: str = SQLField(nullable=False)
    response: str = SQLField(nullable=False)
    prompt_tokens: int = SQLField(nullable=False)
    completion_tokens: int = SQLField(nullable=False)
    total_tokens: int = SQLField(nullable=False)
    total_response_time: float = SQLField(nullable=False)
    model: str = SQLField(nullable=False)
    created_at: datetime.datetime = SQLField(
        default=datetime.datetime.now(datetime.timezone.utc), nullable=False
    )


from sqlmodel import SQLModel, Field


class ApiToken(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int
    token: str
    description: Optional[str] = None
    created_at: datetime.datetime = SQLField(
        default=datetime.datetime.now(datetime.timezone.utc), nullable=False
    )
    deleted_at: Optional[datetime.datetime] = SQLField(default=None, nullable=True)


class UserCredits(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: str
    credits: float = SQLField(default=0.0, nullable=False)
    created_at: datetime.datetime = SQLField(
        default=datetime.datetime.now(datetime.timezone.utc), nullable=False
    )
    updated_at: datetime.datetime = SQLField(
        default=datetime.datetime.now(datetime.timezone.utc), nullable=False
    )


class UserCreditsHistory(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: str
    amount: float
    description: Optional[str] = SQLField(default=None, nullable=True)
    created_at: datetime.datetime = SQLField(
        default=datetime.datetime.now(datetime.timezone.utc), nullable=False
    )
