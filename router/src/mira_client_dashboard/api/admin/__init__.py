from fastapi import APIRouter
from .users import router as user_router

router = APIRouter()

# Include all routers
router.include_router(user_router, tags=["admin"])

__all__ = ["router"]
