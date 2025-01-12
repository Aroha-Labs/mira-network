from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

from src.router.schemas.ai import Message


class FlowRequest(BaseModel):
    system_prompt: str
    name: str


class FlowChatCompletion(BaseModel):
    model: str
    messages: List[Message]
    variables: Optional[Dict[str, Any]] = None
    stream: bool = False


class FlowUpdateRequest(BaseModel):
    system_prompt: Optional[str] = Field(None, title="System Prompt")
    name: Optional[str] = Field(None, title="Name")
