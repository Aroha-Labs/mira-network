from fastapi import APIRouter
from pydantic import BaseModel
from src.mira_client_dashboard.core.security import supabase

router = APIRouter()


@router.get("/users")
def list_users(page: int = 1, per_page: int = 10):
    return supabase.auth.admin.list_users(page=page, per_page=per_page)
