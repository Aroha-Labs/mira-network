from typing import Dict, List, Optional
from sqlalchemy import Column, DateTime, func, JSON
from sqlmodel import SQLModel, Field as SQLField
from datetime import datetime
from uuid import UUID, uuid4


# Thread Model
class Thread(SQLModel, table=True):
    __tablename__ = "threads"

    id: UUID = SQLField(default_factory=uuid4, primary_key=True)
    title: str = SQLField(nullable=False)
    user_id: UUID = SQLField(nullable=False, index=True)
    created_at: datetime = SQLField(default=func.now(), nullable=False)
    updated_at: datetime = SQLField(default=func.now(), nullable=False)
    thread_metadata: Dict = SQLField(sa_type=JSON, nullable=True, default={})
    is_archived: bool = SQLField(default=False)


# Message Model
class Message(SQLModel, table=True):
    __tablename__ = "messages"

    id: UUID = SQLField(default_factory=uuid4, primary_key=True)
    thread_id: UUID = SQLField(nullable=False, index=True)
    role: str = SQLField(nullable=False)
    content: str = SQLField(nullable=False)
    tool_calls: List[Dict] = SQLField(sa_type=JSON, nullable=True)
    created_at: datetime = SQLField(default=func.now(), nullable=False)
    message_metadata: Dict = SQLField(sa_type=JSON, nullable=True, default={})
    parent_message_id: Optional[UUID] = SQLField(nullable=True)


# ToolCall Model (for function calls)
class ToolCall(SQLModel, table=True):
    __tablename__ = "tool_calls"

    id: UUID = SQLField(default_factory=uuid4, primary_key=True)
    message_id: UUID = SQLField(nullable=False, index=True)
    type: str = SQLField(index=True)  # e.g., "function"
    name: str
    arguments: str
    response: Optional[str] = None
    created_at: datetime = SQLField(
        sa_column=Column(DateTime(timezone=True), server_default=func.now())
    )
