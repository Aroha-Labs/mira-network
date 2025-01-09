from sqlmodel import create_engine, Session

# Create a test-specific engine using SQLite in-memory database
test_engine = create_engine(
    "sqlite:///./test.db",
    connect_args={"check_same_thread": False}
)

def get_test_session():
    with Session(test_engine) as session:
        yield session