from typing import Optional, List, Dict
from pydantic import BaseModel, Field, field_validator


class Message(BaseModel):
    role: str
    content: str

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        valid_roles = ["system", "user", "assistant"]
        if v not in valid_roles:
            raise ValueError(f"Invalid role. Must be one of: {valid_roles}")
        return v


class ModelProvider(BaseModel):
    base_url: str
    api_key: str


class AiRequest(BaseModel):
    model: str = Field("mira/llama3.1", title="Model")
    model_provider: Optional[ModelProvider] = Field(None, title="Model Provider (optional)")
    messages: List[Message] = Field([], title="Messages")
    stream: Optional[bool] = Field(False, title="Stream")

    @field_validator("messages")
    @classmethod
    def validate_messages(cls, v: List[Message]) -> List[Message]:
        if not v:
            raise ValueError("Messages list cannot be empty")
        return v


class FlowChatCompletion(BaseModel):
    variables: Optional[Dict] = Field(None, title="Variables")


class FlowRequest(BaseModel):
    system_prompt: str
    name: str


class ApiTokenRequest(BaseModel):
    description: Optional[str] = None


class AddCreditRequest(BaseModel):
    user_id: str
    amount: float
    description: Optional[str] = None

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Amount must be greater than 0")
        return v

    @field_validator("user_id")
    @classmethod
    def validate_user_id(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("User ID cannot be empty")
        return v
