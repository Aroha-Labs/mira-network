import os
from sqlmodel import create_engine
from dotenv import load_dotenv

load_dotenv()

engine = create_engine(
    os.getenv("DB_CONNECTION_STRING"),
    connect_args={"sslmode": "require"},
)
