from pydantic import BaseModel
from typing import Optional

class AddCreditRequest(BaseModel):
    user_id: str
    amount: float
    description: Optional[str] = None