from prometheus_client import Counter, Histogram, Gauge
from typing import Dict, Any
import time
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

# Custom metrics
ERROR_COUNTER = Counter(
    'http_error_total',
    'Total count of HTTP errors',
    ['status_code', 'error_type', 'endpoint']
)

ERROR_DETAILS = Counter(
    'http_error_details',
    'Detailed error information',
    ['status_code', 'error_type', 'endpoint', 'error_message']
)

REQUEST_LATENCY = Histogram(
    'http_request_duration_seconds',
    'HTTP request latency in seconds',
    ['method', 'endpoint', 'status_code']
)

# Additional custom metrics (complementing prometheus-fastapi-instrumentator)
REQUEST_SIZE = Histogram(
    'http_request_size_bytes',
    'HTTP request size in bytes',
    ['method', 'endpoint']
)

RESPONSE_SIZE = Histogram(
    'http_response_size_bytes',
    'HTTP response size in bytes',
    ['method', 'endpoint', 'status_code']
)

class PrometheusMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: ASGIApp):
        super().__init__(app)

    async def dispatch(self, request: Request, call_next):
        start_time = time.time()
        
        # Track request size
        request_size = 0
        if hasattr(request, 'headers') and 'content-length' in request.headers:
            try:
                request_size = int(request.headers['content-length'])
            except (ValueError, TypeError):
                request_size = 0
        
        REQUEST_SIZE.labels(
            method=request.method,
            endpoint=request.url.path
        ).observe(request_size)
        
        try:
            response = await call_next(request)
            process_time = time.time() - start_time
            
            # Record request latency
            REQUEST_LATENCY.labels(
                method=request.method,
                endpoint=request.url.path,
                status_code=response.status_code
            ).observe(process_time)
            
            # Track response size
            response_size = 0
            if hasattr(response, 'headers') and 'content-length' in response.headers:
                try:
                    response_size = int(response.headers['content-length'])
                except (ValueError, TypeError):
                    response_size = 0
            
            RESPONSE_SIZE.labels(
                method=request.method,
                endpoint=request.url.path,
                status_code=response.status_code
            ).observe(response_size)
            
            # Record error if status code is 4xx or 5xx
            if response.status_code >= 400:
                ERROR_COUNTER.labels(
                    status_code=response.status_code,
                    error_type='http_error',
                    endpoint=request.url.path
                ).inc()
            
            return response
            
        except Exception as e:
            process_time = time.time() - start_time
            
            # Record error metrics
            ERROR_COUNTER.labels(
                status_code=500,
                error_type=type(e).__name__,
                endpoint=request.url.path
            ).inc()
            
            ERROR_DETAILS.labels(
                status_code=500,
                error_type=type(e).__name__,
                endpoint=request.url.path,
                error_message=str(e)
            ).inc()
            
            # Record latency for failed requests
            REQUEST_LATENCY.labels(
                method=request.method,
                endpoint=request.url.path,
                status_code=500
            ).observe(process_time)
            
            raise 
