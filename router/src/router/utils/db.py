from sqlmodel.ext.asyncio.session import AsyncSession
from contextlib import asynccontextmanager


@asynccontextmanager
async def safe_transaction(db: AsyncSession):
    """
    A context manager that safely handles transactions, checking if one is already in progress.
    If a transaction exists, yields the session without starting a new one.
    If no transaction exists, starts a new one.
    """
    if db.in_transaction():
        yield db
    else:
        async with db.begin():
            yield db
