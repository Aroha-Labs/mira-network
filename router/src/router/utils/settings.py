from typing import Any, Dict, Optional, TypeVar, Type
from pydantic import BaseModel
from sqlmodel import select
from src.router.db.session import get_session_context
from src.router.models.system_settings import SystemSettings
from fastapi import HTTPException
from src.router.core.settings_types import SETTINGS_MODELS
from src.router.utils.redis import get_cached_setting, set_cached_setting

T = TypeVar("T", bound=BaseModel)


async def get_setting(name: str):
    """Get a system setting by name."""
    async with get_session_context() as db:
        result = await db.exec(
            select(SystemSettings).where(SystemSettings.name == name)
        )
        row = result.first()
        return row


async def get_setting_value(name: str, model: Type[T] = None):
    """Get a system setting value by name with optional model validation."""
    # Try to get from cache first
    cached_value = await get_cached_setting(name)
    if cached_value:
        if model:
            return model(**cached_value)
        return cached_value

    # If not in cache, get from database
    setting = await get_setting(name)
    if not setting:
        raise HTTPException(status_code=404, detail=f"Setting {name} not found")

    # Cache the setting
    await set_cached_setting(name, setting.value)

    if model:
        try:
            return model(**setting.value)
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Invalid setting format for {name}: {str(e)}",
            )
    return setting.value


async def get_supported_models():
    """Get the supported models configuration."""
    resp = await get_setting_value(
        "SUPPORTED_MODELS",
        SETTINGS_MODELS["SUPPORTED_MODELS"],
    )
    return resp.root


def validate_setting_name(name: str):
    """Validate if the setting name is supported and has a defined model."""
    if name not in SETTINGS_MODELS:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown setting name. Supported settings: {', '.join(SETTINGS_MODELS.keys())}",
        )


async def update_setting_value(
    name: str,
    value: Dict[str, Any],
    description: Optional[str] = None,
    model: Type[T] = None,
) -> SystemSettings:
    """Update or create a system setting."""
    validate_setting_name(name)
    model = model or SETTINGS_MODELS[name]

    if model:
        try:
            model(**value)
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid setting format: {str(e)}",
            )

    setting = await get_setting(name)
    if setting:
        setting.value = value
        if description is not None:
            setting.description = description
    else:
        setting = SystemSettings(name=name, value=value, description=description)

    async with get_session_context() as db:
        db.add(setting)
        await db.commit()
        await db.refresh(setting)

    # Update cache
    await set_cached_setting(name, setting.value)

    return setting
