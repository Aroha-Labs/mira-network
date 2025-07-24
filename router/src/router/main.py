from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from src.router.api.v1 import router as v1_router
from src.router.api.admin import router as admin_router
import uvicorn
from prometheus_fastapi_instrumentator import Instrumentator
from prometheus_fastapi_instrumentator.metrics import requests
from scalar_fastapi import get_scalar_api_reference
import os
from datetime import datetime
from src.router.utils.redis import cleanup
from fastapi.responses import JSONResponse
from fastapi.middleware import Middleware
from contextlib import asynccontextmanager
from src.router.db.session import async_engine
from src.router.utils.metrics import PrometheusMiddleware
from src.router.utils.logger import logger


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

# Add global exception handler for NoneType and other common errors
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Global exception handler to catch and properly format all unhandled exceptions"""
    logger.error(
        f"Unhandled exception in {request.method} {request.url}: {type(exc).__name__}: {str(exc)}",
        exc_info=True
    )
    
    # Special handling for NoneType errors
    if "NoneType" in str(exc) or isinstance(exc, AttributeError):
        return JSONResponse(
            status_code=500,
            content={
                "error": "Internal server error",
                "detail": "A null reference error occurred. Please try again.",
                "type": "NoneTypeError",
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "service": "mira-network-router"
            }
        )
    
    # Generic error response
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "detail": "An unexpected error occurred. Please try again.",
            "type": type(exc).__name__,
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "service": "mira-network-router"
        }
    )

# Include routers
app.include_router(v1_router)

# Include admin routers
app.include_router(admin_router, prefix="/admin")


@app.get("/")
async def read_root():
    return {"message": "Welcome to the FastAPI service"}


@app.get("/health")
async def health_check():
    """Basic health check endpoint"""
    return {"status": "ok", "version": os.getenv("VERSION", "0.0.0")}


@app.get("/health/detailed")
async def detailed_health_check():
    """Detailed health check with dependency status"""
    health_status = {
        "status": "ok",
        "version": os.getenv("VERSION", "0.0.0"),
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "dependencies": {}
    }
    
    # Check Redis connection
    try:
        from src.router.utils.redis import redis_client
        if redis_client:
            await redis_client.ping()
            health_status["dependencies"]["redis"] = "healthy"
        else:
            health_status["dependencies"]["redis"] = "unavailable"
            health_status["status"] = "degraded"
    except Exception as e:
        health_status["dependencies"]["redis"] = f"error: {str(e)}"
        health_status["status"] = "degraded"
    
    # Check OpenSearch connection
    try:
        from src.router.utils.opensearch import opensearch_client
        if opensearch_client:
            opensearch_client.ping()
            health_status["dependencies"]["opensearch"] = "healthy"
        else:
            health_status["dependencies"]["opensearch"] = "unavailable"
            health_status["status"] = "degraded"
    except Exception as e:
        health_status["dependencies"]["opensearch"] = f"error: {str(e)}"
        health_status["status"] = "degraded"
    
    return health_status


@app.get("/connection-test")
async def connection_test():
    """Endpoint specifically for connection testing by external services"""
    try:
        # This endpoint provides a simple way for external services to test connectivity
        # without triggering complex authentication or business logic
        return {
            "status": "connected",
            "service": "mira-network-router",
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "connection_test": True
        }
    except Exception as e:
        logger.error(f"Connection test failed: {str(e)}")
        return {
            "status": "error",
            "service": "mira-network-router",
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "connection_test": True,
            "error": str(e)
        }


@app.get("/docs", include_in_schema=False)
async def docs():
    return get_scalar_api_reference(
        openapi_url="/openapi.json",
        title=app.title,
        scalar_theme="solarized",
    )


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
