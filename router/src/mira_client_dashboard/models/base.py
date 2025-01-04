from sqlmodel import SQLModel
from src.mira_client_dashboard.db.base import engine


async def create_db_and_tables():
    """Create all tables in database"""
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
