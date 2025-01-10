from typing import Optional
from sqlalchemy import TypeDecorator, func
from sqlmodel import SQLModel, Field, Column
from datetime import datetime
from sqlalchemy.dialects.postgresql import JSONB

from src.router.core.types import ModelPricing


class ModelPricingType(TypeDecorator):
    impl = JSONB

    def process_bind_param(self, value, dialect):
        if value is not None:
            return value.dict()  # Convert ModelPricing instance to dict
        return value

    def process_result_value(self, value, dialect):
        if value is not None:
            return ModelPricing(**value)  # Convert dict to ModelPricing instance
        return value


class ApiLogs(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    user_id: str = Field(index=True)
    payload: Optional[str] = Field()
    request_payload: Optional[dict] = Field(sa_column=Column(JSONB))
    ttft: Optional[float] = Field(description="Time to first token")
    response: str
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    total_response_time: float
    model: str
    model_pricing: Optional[ModelPricing] = Field(sa_column=Column(ModelPricingType))
    machine_id: Optional[str] = Field(index=True)
    created_at: datetime = Field(default=func.now(), nullable=False)
