from pydantic import BaseModel
from typing import Dict, Any


class MachineInfo(BaseModel):
    machine_uid: str
    network_ip: str


class MachineAuthToken(BaseModel):
    description: str | None = None


class RegisterMachineRequest(BaseModel):
    network_ip: str
    name: str | None = None
    description: str | None = None
    auth_tokens: Dict[str, MachineAuthToken] = {}
