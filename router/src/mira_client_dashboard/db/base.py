import os
from sqlmodel import create_engine

engine = create_engine(
    os.getenv("DB_CONNECTION_STRING"),
    connect_args={"sslmode": "require"},
)
