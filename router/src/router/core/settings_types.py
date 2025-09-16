from pydantic import BaseModel, RootModel
from typing import Dict, Optional


class ModelCapabilities(BaseModel):
    pdf: bool = False
    code: bool = False
    json: bool = False
    vision: bool = False
    web_search: bool = False
    function_calling: bool = False


class ModelConfig(BaseModel):
    id: str
    prompt_token: float
    completion_token: float
    capabilities: Optional[ModelCapabilities] = None


class SupportedModelsSettings(RootModel):
    root: Dict[str, ModelConfig]


# Add more settings types as needed
SETTINGS_MODELS = {"SUPPORTED_MODELS": SupportedModelsSettings}
