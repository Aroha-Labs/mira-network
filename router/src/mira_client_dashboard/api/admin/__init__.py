from fastapi import APIRouter
from .users import router as user_router
from .credits import router as credit_router

router = APIRouter()

# Include all routers
router.include_router(user_router, tags=["admin"])
router.include_router(credit_router, tags=["admin"])

__all__ = ["router"]
