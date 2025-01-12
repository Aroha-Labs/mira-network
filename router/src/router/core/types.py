from typing import List, Optional
from gotrue import User as GoUser
from pydantic import BaseModel


class User(GoUser):
    roles: List[str] = []
    api_key_id: Optional[int] = None


class ModelPricing(BaseModel):
    model: str
    prompt_token: float
    completion_token: float
