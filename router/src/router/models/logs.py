from sqlalchemy import func
from sqlmodel import SQLModel, Field
from datetime import datetime


class ApiLogs(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    user_id: str
    payload: str
    response: str
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    total_response_time: float
    model: str
    created_at: datetime = Field(default=func.now(), nullable=False)
