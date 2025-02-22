from contextlib import asynccontextmanager
from sqlmodel import Session
from typing import Generator, AsyncGenerator
from .base import engine, async_engine
from sqlmodel.ext.asyncio.session import AsyncSession


def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session  # Use "with" to ensure proper closing


async def get_async_session() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSession(async_engine) as session:
        yield session


@asynccontextmanager
async def get_session_context() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSession(async_engine) as session:
        try:
            yield session
        finally:
            await session.close()
