from typing import List
from gotrue import User as GoUser
from pydantic import BaseModel


class User(GoUser):
    roles: List[str] = []


class ModelPricing(BaseModel):
    model: str
    prompt_token: float
    completion_token: float
