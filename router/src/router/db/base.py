import os
from sqlmodel import create_engine
from sqlalchemy.ext.asyncio import create_async_engine

engine = create_engine(
    os.getenv("DB_CONNECTION_STRING"),
    pool_size=2,  # Reduce pool size per Fargate container (RDS Proxy manages pooling)
    max_overflow=4,  # Lower than before to prevent too many connections
    pool_recycle=600,  # Prevent stale connections (RDS Proxy recommended)
    pool_timeout=30,  # Wait time before raising TimeoutError
)

async_engine = create_async_engine(
    os.getenv("ASYNC_DB_CONNECTION_STRING"),
    pool_size=2,  # Reduce pool size per Fargate container (RDS Proxy manages pooling)
    max_overflow=4,  # Lower than before to prevent too many connections
    pool_recycle=600,  # Prevent stale connections (RDS Proxy recommended)
    pool_timeout=30,  # Wait time before raising TimeoutError
)
