from pydantic import BaseModel, Field
from typing import Optional

class ModelProvider(BaseModel):
    base_url: str
    api_key: str

class Message(BaseModel):
    role: str
    content: str

class AiRequest(BaseModel):
    model: str = Field("mira/llama3.1", title="Model")
    model_provider: Optional[ModelProvider] = Field(
        None, title="Model Provider (optional)"
    )
    messages: list[Message] = Field([], title="Messages")
    stream: Optional[bool] = Field(False, title="Stream")
    model_config = {
        'protected_namespaces': ()  # This disables the warning
    }

class VerifyRequest(BaseModel):
    messages: list[Message] = Field([], title="Messages")
    models: list[str] = Field(["mira/llama3.1"], title="Models")
    min_yes: int = Field(3, title="Minimum yes")


