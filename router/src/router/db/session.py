from contextlib import asynccontextmanager
import os
from fastapi import Depends
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy.pool import NullPool
from typing import Annotated, AsyncGenerator
from sqlmodel.ext.asyncio.session import AsyncSession

# engine = create_engine(
#     os.getenv("DB_CONNECTION_STRING"),
#     pool_size=2,  # Reduce pool size per Fargate container (RDS Proxy manages pooling)
#     max_overflow=4,  # Lower than before to prevent too many connections
#     pool_recycle=600,  # Prevent stale connections (RDS Proxy recommended)
#     pool_timeout=30,  # Wait time before raising TimeoutError
# )

async_engine = create_async_engine(
    url=os.getenv("ASYNC_DB_CONNECTION_STRING"),
    poolclass=NullPool,
)

# Create Async Session Factory
async_session_factory = async_sessionmaker(
    async_engine,
    expire_on_commit=False,  # Keeps objects attached to the session
    class_=AsyncSession,
)


# def get_session() -> Generator[Session, None, None]:
#     with Session(engine) as session:
#         yield session  # Use "with" to ensure proper closing


# Dependency function for Async DB session
async def get_async_session() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_factory() as session:
        yield session  # Ensures proper cleanup


@asynccontextmanager
async def get_session_context() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSession(async_engine) as session:
        try:
            yield session
        finally:
            await session.close()


DBSession = Annotated[AsyncSession, Depends(get_async_session)]
