from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from pydantic import BaseModel
from src.router.core.security import verify_admin
from src.router.models.system_settings import SystemSettings
from src.router.db.session import get_session
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
    db_setting = SystemSettings(**setting.model_dump())
    db.add(db_setting)
    db.commit()
    db.refresh(db_setting)
    return db_setting


@router.put("/settings/{name}", response_model=SystemSettings)
def update_setting(
    name: str,
    setting: SystemSettingUpdate,
    db: Session = Depends(get_session),
    user=Depends(verify_admin),
):
    db_setting = db.exec(
        select(SystemSettings).where(SystemSettings.name == name)
    ).first()
    if not db_setting:
        raise HTTPException(status_code=404, detail="Setting not found")

    for key, value in setting.model_dump().items():
        setattr(db_setting, key, value)

    db.add(db_setting)
    db.commit()
    db.refresh(db_setting)
    return db_setting
