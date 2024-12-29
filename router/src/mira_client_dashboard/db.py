from sqlmodel import SQLModel, Session, create_engine
from .models import ApiToken

sqlite_file_name = "database.db"
sqlite_url = f"sqlite:///{sqlite_file_name}"

connect_args = {"check_same_thread": False}
engine = create_engine(sqlite_url, connect_args=connect_args)


def create_db_and_tables():
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        # Filter out soft-deleted tokens
        session.query(ApiToken).filter(ApiToken.deleted_at.is_(None))
        yield session
