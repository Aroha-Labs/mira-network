from typing import Any, Dict, Optional, TypeVar, Type
from pydantic import BaseModel
from sqlmodel import Session, select
from src.router.models.system_settings import SystemSettings
from fastapi import HTTPException
from src.router.core.settings_types import (
    SETTINGS_MODELS,
    ModelConfig,
)

T = TypeVar("T", bound=BaseModel)


def get_setting(db: Session, name: str) -> Optional[SystemSettings]:
    """Get a system setting by name."""
    return db.exec(select(SystemSettings).where(SystemSettings.name == name)).first()


def get_setting_value(db: Session, name: str, model: Type[T] = None):
    """Get a system setting value by name with optional model validation."""
    setting = get_setting(db, name)
    if not setting:
        raise HTTPException(status_code=404, detail=f"Setting {name} not found")

    if model:
        try:
            return model(**setting.value)
        except Exception as e:
            raise HTTPException(
                status_code=500, detail=f"Invalid setting format for {name}: {str(e)}"
            )
    return setting.value


def get_supported_models(db: Session) -> Dict[str, ModelConfig]:
    """Get the supported models configuration."""
    return get_setting_value(
        db,
        "SUPPORTED_MODELS",
        SETTINGS_MODELS["SUPPORTED_MODELS"],
    ).root


def validate_setting_name(name: str) -> None:
    """Validate if the setting name is supported and has a defined model."""
    if name not in SETTINGS_MODELS:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown setting name. Supported settings: {', '.join(SETTINGS_MODELS.keys())}",
        )


def update_setting_value(
    db: Session,
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
                status_code=400, detail=f"Invalid setting format: {str(e)}"
            )

    setting = get_setting(db, name)
    if setting:
        setting.value = value
        if description is not None:
            setting.description = description
    else:
        setting = SystemSettings(name=name, value=value, description=description)

    db.add(setting)
    db.commit()
    db.refresh(setting)
    return setting
