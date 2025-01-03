from sqlmodel import create_engine, SQLModel

engine = create_engine(
    "sqlite:///database.db",
    connect_args={"check_same_thread": False},
)