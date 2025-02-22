import os
from sqlmodel import create_engine
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import NullPool

engine = create_engine(
    os.getenv("DB_CONNECTION_STRING"),
    poolclass=NullPool, # Disable connection pooling to avoid stale connections in serverless environments
)

async_engine = create_async_engine(
    os.getenv("ASYNC_DB_CONNECTION_STRING"),
    poolclass=NullPool, # Disable connection pooling to avoid stale connections in serverless environments
)
