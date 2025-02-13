from pydantic import BaseModel
from typing import Optional
from pydantic import Field


class ApiTokenRequest(BaseModel):
    description: Optional[str] = None
    meta_data: Optional[dict] = Field(default={})
