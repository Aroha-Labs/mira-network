from pydantic import BaseModel, Field
from typing import Optional, Literal


class ModelProvider(BaseModel):
    base_url: str
    api_key: str


class Message(BaseModel):
    role: str
    content: str


class FunctionCall(BaseModel):
    name: str
    arguments: str


class Function(BaseModel):
    name: str
    description: str
    parameters: dict = Field(
        default_factory=lambda: {"type": "object", "properties": {}, "required": []}
    )


class Tool(BaseModel):
    type: str = "function"
    function: Function


class AiRequest(BaseModel):
    model: str = Field("mira/llama3.1", title="Model")
    model_provider: Optional[ModelProvider] = Field(
        None, title="Model Provider (optional)"
    )
    messages: list[Message] = Field([], title="Messages")
    stream: Optional[bool] = Field(False, title="Stream")
    tools: Optional[list[Tool]] = Field(None, title="Tools")
    tool_choice: Optional[str] = Field("auto", title="Tool Choice")
    model_config = {"protected_namespaces": ()}  # This disables the warning
    reasoning_effort: Optional[Literal["high", "medium", "low"]] = Field(
        None, title="Reasoning Effort"
    )
    max_tokens: Optional[int] = Field(None, title="Max Tokens")
    os: Optional[str] = Field(
        "web",
        title="Operating System",
        description="The operating system type (e.g., 'mobile', 'desktop', 'web', 'ios', 'android')",
    )


class VerifyRequest(BaseModel):
    messages: list[Message] = Field([], title="Messages")
    models: list[str] = Field(["mira/llama3.1"], title="Models")
    min_yes: int = Field(3, title="Minimum yes")
