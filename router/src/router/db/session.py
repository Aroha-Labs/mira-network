from sqlmodel import Session
from typing import Generator
from .base import engine


def get_session() -> Generator[Session, None, None]:
    session = Session(engine)
    try:
        yield session  # Provide session to FastAPI endpoint
    finally:
        session.close()  # ✅ Ensures session is closed after request
