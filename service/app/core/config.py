import os
from typing import Dict

from ..models.chat import ModelProvider

MACHINE_IP = os.getenv("MACHINE_IP", "localhost")
ROUTER_BASE_URL = os.getenv(
    "ROUTER_BASE_URL",
    "https://mira-client-balancer.alts.dev",
)

# Model provider configurations
MODEL_PROVIDERS: Dict[str, ModelProvider] = {
    "openai": ModelProvider(
        base_url="https://api.openai.com/v1",
        api_key=os.getenv("OPENAI_API_KEY"),
        provider_name="openai",
    ),
    "openrouter": ModelProvider(
        base_url="https://openrouter.ai/api/v1",
        api_key=os.getenv("OPENROUTER_API_KEY"),
        provider_name="openrouter",
    ),
    "anthropic": ModelProvider(
        base_url="https://api.anthropic.com/v1",
        api_key=os.getenv("ANTHROPIC_API_KEY"),
        provider_name="anthropic",
    ),
    "mira": ModelProvider(
        base_url=os.getenv("MIRA_BASE_URL", "https://ollama.alts.dev/v1"),
        api_key=os.getenv("MIRA_API_KEY"),
        provider_name="mira",
    ),
} 