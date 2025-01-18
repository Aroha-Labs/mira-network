from fastapi import APIRouter
from .users import router as user_router
from .settings import router as settings_router

router = APIRouter()

# Include all routers
router.include_router(user_router, tags=["admin"])
router.include_router(settings_router, tags=["admin"])

__all__ = ["router"]
