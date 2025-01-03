from sqlmodel import SQLModel, Field as SQLField
import datetime

class Machine(SQLModel, table=True):
    id: int = SQLField(primary_key=True)
    network_machine_uid: str = SQLField(index=True)
    network_ip: str = SQLField(index=True)

    created_at: str = SQLField(
        default=datetime.datetime.now(datetime.timezone.utc), nullable=False
    )
    updated_at: str = SQLField(
        default=datetime.datetime.now(datetime.timezone.utc), nullable=False
    )