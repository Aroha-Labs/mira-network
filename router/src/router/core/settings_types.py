from pydantic import BaseModel, RootModel
from typing import Dict


class ModelConfig(BaseModel):
    id: str
    prompt_token: float
    completion_token: float


class SupportedModelsSettings(RootModel):
    root: Dict[str, ModelConfig]


# Add more settings types as needed
SETTINGS_MODELS = {"SUPPORTED_MODELS": SupportedModelsSettings}
