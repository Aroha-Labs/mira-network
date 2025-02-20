import os
from sqlmodel import create_engine

engine = create_engine(
    os.getenv("DB_CONNECTION_STRING"),
    connect_args={"sslmode": os.getenv("DB_SSL_MODE", "require")},
    pool_size=0,  # ✅ Disable SQLAlchemy's internal pool
    max_overflow=0,  # ✅ Prevent overflow since RDS Proxy handles it
    pool_pre_ping=True,  # ✅ Ensures stale connections are dropped
)
