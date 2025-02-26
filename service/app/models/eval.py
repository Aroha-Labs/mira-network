from pydantic import BaseModel, Field
from typing import List


class EvaluationRequest(BaseModel):
    csv: str
    models: List[str]
    eval_system_prompt: str 