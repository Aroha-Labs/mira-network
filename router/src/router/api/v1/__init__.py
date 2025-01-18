from fastapi import APIRouter
from .flows import router as flows_router
from .tokens import router as tokens_router
from .credits import router as credits_router
from .logs import router as logs_router
from .network import router as network_router
from .machines import router as machines_router
from .proxy import router as proxy_router
from .users import router as users_router  # Add users import

router = APIRouter()

# Include all routers
router.include_router(machines_router, tags=["machines"])
router.include_router(flows_router, tags=["flows"])
router.include_router(tokens_router, tags=["tokens"])
router.include_router(credits_router, tags=["credits"])
router.include_router(logs_router, tags=["logs"])
router.include_router(network_router, tags=["network"])
router.include_router(proxy_router, tags=["proxy"])
router.include_router(users_router, tags=["users"])  # Add users router

__all__ = ["router"]
