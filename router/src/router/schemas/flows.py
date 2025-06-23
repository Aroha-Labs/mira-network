from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any, Union
from enum import Enum
from datetime import datetime

from src.router.schemas.ai import Message, Tool, Function


class FlowRequest(BaseModel):
    system_prompt: str
    name: str


class FlowChatCompletion(BaseModel):
    model: str
    messages: List[Message]
    variables: Optional[Dict[str, Any]] = None
    stream: bool = False
    tools: Optional[list[Tool]] = Field(None, title="Tools")
    tool_choice: Optional[str] = Field("auto", title="Tool Choice")
    os: Optional[str] = Field(
        "web",
        title="Operating System",
        description="The operating system type (e.g., 'mobile', 'desktop', 'web', 'ios', 'android')",
    )


class FlowUpdateRequest(BaseModel):
    system_prompt: Optional[str] = Field(None, title="System Prompt")
    name: Optional[str] = Field(None, title="Name")


class TimeRange(str, Enum):
    last_24h = "24h"
    last_7d = "7d"
    last_30d = "30d"


class ModelStats(BaseModel):
    requests: int
    total_tokens: int
    average_response_time: float
    cost: float


class TimeSeriesEntry(BaseModel):
    timestamp: datetime
    tokens: int
    cost: float


class FlowAnalytics(BaseModel):
    # Flow performance metrics
    average_response_time: float
    ttft: float  # Time to first token

    # Usage metrics
    total_tokens: int
    prompt_tokens: int
    completion_tokens: int

    # Cost metrics
    total_cost: float

    # Model usage breakdown
    requests_by_model: Dict[str, ModelStats]

    # Time series for trends
    time_series_data: List[TimeSeriesEntry]


class FlowStats(BaseModel):
    # Current stats
    total_tokens: int
    prompt_tokens: int
    completion_tokens: int
    total_cost: float
    model: str
    model_pricing: Dict[str, float]
    total_response_time: float
    ttft: float

    # Time series data
    time_series: List[Dict[str, Any]]  # List of {timestamp, tokens, cost}
