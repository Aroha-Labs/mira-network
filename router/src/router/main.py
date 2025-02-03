from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from src.router.api.v1 import router as v1_router
from src.router.api.admin import router as admin_router
import uvicorn
from prometheus_fastapi_instrumentator import Instrumentator
from scalar_fastapi import get_scalar_api_reference
import os
from src.router.models.credit_trigger import setup_credit_triggers
from src.router.services.credit_listener import start_credit_listener
import threading


def start_background_services():
    """Start background services."""
    # Start credit listener in a separate thread
    credit_listener_thread = threading.Thread(target=start_credit_listener, daemon=True)
    credit_listener_thread.start()


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
)

Instrumentator().instrument(app).expose(app)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(v1_router)

# Include admin routers
app.include_router(admin_router, prefix="/admin")


@app.get("/")
def read_root():
    return {"message": "Welcome to the FastAPI service"}


@app.get("/health")
def health_check():
    return {"status": "ok", "version": os.getenv("VERSION", "0.0.0")}


@app.get("/docs", include_in_schema=False)
def docs():
    return get_scalar_api_reference(
        openapi_url="/openapi.json",
        title=app.title,
    )


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
