from pydantic import BaseModel

class MachineInfo(BaseModel):
    machine_uid: str
    network_ip: str

class RegisterMachineRequest(BaseModel):
    network_ip: str

