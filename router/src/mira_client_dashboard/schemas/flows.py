from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


class FlowRequest(BaseModel):
    system_prompt: str
    name: str

class FlowChatCompletion(BaseModel):
    messages: List[Dict[str, str]]
    variables: Optional[Dict[str, Any]] = None

class FlowUpdateRequest(BaseModel):
    system_prompt: Optional[str] = Field(None, title="System Prompt")
    name: Optional[str] = Field(None, title="Name")
