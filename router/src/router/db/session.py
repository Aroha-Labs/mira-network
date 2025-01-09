from sqlmodel import Session
from typing import Generator
from .base import engine


def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session
