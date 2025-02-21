from contextlib import asynccontextmanager
from sqlmodel import Session
from typing import Generator, AsyncGenerator
from .base import engine, async_engine
from sqlmodel.ext.asyncio.session import AsyncSession


def get_session() -> Generator[Session, None, None]:
    session = Session(engine)
    try:
        yield session  # Provide session to FastAPI endpoint
    finally:
        session.close()  # ✅ Ensures session is closed after request


async def get_async_session() -> AsyncGenerator[AsyncSession, None]:
    session = AsyncSession(async_engine)
    try:
        yield session  # Provide session to FastAPI endpoint
    finally:
        await session.close()  # ✅ Ensures session is closed after request


@asynccontextmanager
async def get_session_context() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSession(async_engine) as session:
        try:
            yield session
        finally:
            await session.close()
