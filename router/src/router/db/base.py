import os
from sqlmodel import create_engine
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import QueuePool

engine = create_engine(
    os.getenv("DB_CONNECTION_STRING"),
    connect_args={"sslmode": os.getenv("DB_SSL_MODE", "require")},
    poolclass=QueuePool,
    pool_size=5,  # Adjust based on your needs
    max_overflow=10,  # Adjust based on your needs
    pool_pre_ping=True,
    pool_recycle=3600,  # Recycle connections after 1 hour
)

async_engine = create_async_engine(
    os.getenv("ASYNC_DB_CONNECTION_STRING"),
    connect_args={"sslmode": os.getenv("DB_SSL_MODE", "require")},
    pool_size=5,  # Adjust based on your needs
    max_overflow=10,  # Adjust based on your needs
    pool_pre_ping=True,
    pool_recycle=3600,  # Recycle connections after 1 hour
)
