import os
from sqlmodel import create_engine
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import QueuePool

engine = create_engine(
    os.getenv("DB_CONNECTION_STRING"),
    pool_size=100,  # Maximum number of persistent connections
    max_overflow=400,  # Maximum number of connections that can be created beyond pool_size
    pool_timeout=30,  # Timeout in seconds for getting a connection from the pool
    pool_recycle=1800,  # Recycle connections after 30 minutes to avoid stale connections
)

async_engine = create_async_engine(
    os.getenv("ASYNC_DB_CONNECTION_STRING"),
    pool_size=100,
    max_overflow=400,
    pool_timeout=30,
    pool_recycle=1800,
)
