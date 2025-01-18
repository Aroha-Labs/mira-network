from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from pydantic import BaseModel
from src.router.core.security import verify_admin
from src.router.models.system_settings import SystemSettings
from src.router.db.session import get_session
from src.router.utils.settings import update_setting_value
from typing import List, Dict, Any

router = APIRouter()


class SystemSettingCreate(BaseModel):
    name: str
    value: Dict[str, Any]
    description: str | None = None


class SystemSettingUpdate(BaseModel):
    value: Dict[str, Any]
    description: str | None = None


@router.get("/settings", response_model=List[SystemSettings])
def get_settings(db: Session = Depends(get_session), user=Depends(verify_admin)):
    return db.exec(select(SystemSettings)).all()


@router.post("/settings", response_model=SystemSettings)
def create_setting(
    setting: SystemSettingCreate,
    db: Session = Depends(get_session),
    user=Depends(verify_admin),
):
    return update_setting_value(db, setting.name, setting.value, setting.description)


@router.put("/settings/{name}", response_model=SystemSettings)
def update_setting(
    name: str,
    setting: SystemSettingUpdate,
    db: Session = Depends(get_session),
    user=Depends(verify_admin),
):
    return update_setting_value(db, name, setting.value, setting.description)
