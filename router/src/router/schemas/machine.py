from pydantic import BaseModel, Field
from typing import Dict, List, Optional


class MachineInfo(BaseModel):
    id: int
    network_ip: str


class MachineAuthToken(BaseModel):
    description: str | None = None


class RegisterMachineRequest(BaseModel):
    network_ip: str
    name: str | None = None
    description: str | None = None
    auth_tokens: Dict[str, MachineAuthToken] = {}
    disabled: bool | None = None
    traffic_weight: float = Field(
        default=0.5,
        ge=0.0,
        le=1.0,
        description="Load balancing weight (0.0-1.0, where 0.5 = 50% traffic)"
    )
    supported_models: Optional[List[str]] = Field(
        default=None,
        description="List of model names this machine supports. If None, supports all models."
    )
    service_access_token: Optional[str] = Field(
        default=None,
        description="Service access token to authenticate with the node-service"
    )
