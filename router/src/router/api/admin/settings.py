from fastapi import APIRouter, Depends
from sqlmodel import select
from pydantic import BaseModel
from src.router.core.security import verify_admin
from src.router.models.system_settings import SystemSettings
from src.router.db.session import DBSession
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
async def get_settings(db: DBSession, user=Depends(verify_admin)):
    res = await db.exec(select(SystemSettings))
    return res.all()


@router.post("/settings", response_model=SystemSettings)
async def create_setting(
    setting: SystemSettingCreate,
    user=Depends(verify_admin),
):
    return await update_setting_value(setting.name, setting.value, setting.description)


@router.put("/settings/{name}", response_model=SystemSettings)
async def update_setting(
    name: str,
    setting: SystemSettingUpdate,
    user=Depends(verify_admin),
):
    return await update_setting_value(name, setting.value, setting.description)
