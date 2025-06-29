from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from src.router.api.v1 import router as v1_router
from src.router.api.admin import router as admin_router
import uvicorn
from prometheus_fastapi_instrumentator import Instrumentator
from prometheus_fastapi_instrumentator.metrics import requests
from scalar_fastapi import get_scalar_api_reference
import os
from src.router.utils.redis import cleanup
from fastapi.responses import JSONResponse
from fastapi.middleware import Middleware
from contextlib import asynccontextmanager
from src.router.db.session import async_engine
from src.router.utils.metrics import PrometheusMiddleware


@asynccontextmanager
async def lifespan(app: FastAPI):
    # # Startup - expose metrics endpoint
    # instrumentator.expose(app)
    
    try:
        yield
    # Shutdown
    finally:
        await cleanup()
        await async_engine.dispose()


app = FastAPI(
    title="Mira Client Dashboard",
    description="API documentation for Mira Client Dashboard",
    version="1.0.0",
    openapi_tags=[
        {"name": "network", "description": "Network related operations"},
        {"name": "tokens", "description": "API token management"},
        {"name": "logs", "description": "API logs"},
        {"name": "credits", "description": "User credits management"},
        {"name": "flows", "description": "Flow management"},
    ],
    openapi_url="/openapi.json",
    docs_url=None,
    redoc_url="/redoc",
    swagger_ui_oauth2_redirect_url="/docs/oauth2-redirect",
    swagger_ui_init_oauth={
        "clientId": "your-client-id",
        "clientSecret": "your-client-secret",
        "realm": "your-realm",
        "appName": "Mira Client Dashboard",
        "scopeSeparator": " ",
        "scopes": {"read": "Read access", "write": "Write access"},
    },
    lifespan=lifespan,
    default_response_class=JSONResponse,
    middleware=[
        Middleware(
            CORSMiddleware,
            allow_origins=["*"],
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        ),
    ],
)

# Setup Prometheus metrics with explicit configuration

instrumentator = Instrumentator(
    should_group_status_codes=False,
    should_ignore_untemplated=False,  # Track all paths
    should_instrument_requests_inprogress=True,
    excluded_handlers=["/health"],
)

# Add the requests metric explicitly
instrumentator.add(requests())

# Instrument and expose
instrumentator.instrument(app).expose(app)

# Add custom middleware for additional error tracking
app.add_middleware(PrometheusMiddleware)

# Include routers
app.include_router(v1_router)

# Include admin routers
app.include_router(admin_router, prefix="/admin")


@app.get("/")
async def read_root():
    return {"message": "Welcome to the FastAPI service"}


@app.get("/health")
async def health_check():
    return {"status": "ok", "version": os.getenv("VERSION", "0.0.0")}


@app.get("/docs", include_in_schema=False)
async def docs():
    return get_scalar_api_reference(
        openapi_url="/openapi.json",
        title=app.title,
        scalar_theme="solarized",
    )


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
