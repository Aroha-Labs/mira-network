from pydantic import BaseModel, Field
from typing import List, Dict, Optional


class Message(BaseModel):
    role: str
    content: str

    def model_dump(self):
        return {"role": self.role, "content": self.content}


class FunctionCall(BaseModel):
    name: str
    arguments: str


class Function(BaseModel):
    name: str
    description: str
    parameters: dict = Field(
        default_factory=lambda: {"type": "object", "properties": {}, "required": []}
    )

    def dict(self):
        return {
            "name": self.name,
            "description": self.description,
            "parameters": self.parameters,
        }


class Tool(BaseModel):
    type: str = "function"
    function: Function

    def model_dump(self):
        return {"type": self.type, "function": self.function.dict()}


class ModelProvider(BaseModel):
    base_url: str
    api_key: str
    provider_name: str


class AiRequest(BaseModel):
    model: str = Field(title="Model", default="")
    model_provider: Optional[ModelProvider] = Field(None, title="Model Provider")
    messages: List[Message] = Field(None, title="Chat History")
    stream: Optional[bool] = Field(False, title="Stream")
    tools: Optional[list[Tool]] = Field(None, title="Tools")
    tool_choice: Optional[str] = Field("auto", title="Tool Choice")


class VerifyRequest(BaseModel):
    model: str = Field(title="Model", default="mira/llama3.1")
    model_provider: Optional[ModelProvider] = Field(None, title="Model Provider")
    messages: List[Message] = Field([], title="Chat History") 