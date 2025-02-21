import os
from sqlmodel import create_engine
from sqlalchemy.pool import NullPool
from sqlalchemy.ext.asyncio import create_async_engine

engine = create_engine(
    os.getenv("DB_CONNECTION_STRING"),
    # connect_args={"sslmode": os.getenv("DB_SSL_MODE", "require")},
    poolclass=NullPool,
    pool_pre_ping=True,  # ✅ Ensures stale connections are dropped
)

async_engine = create_async_engine(
    os.getenv("ASYNC_DB_CONNECTION_STRING"),
    # connect_args={"sslmode": os.getenv("DB_SSL_MODE", "require")},
    poolclass=NullPool,
    pool_pre_ping=True,  # ✅ Ensures stale connections are dropped
)
