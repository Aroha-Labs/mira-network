import random
from typing import Annotated
import datetime

from fastapi import Depends, FastAPI, HTTPException, Query, Request, Response
from pydantic import BaseModel
from sqlmodel import Field, Session, SQLModel, create_engine, select
import redis
import httpx
from fastapi.middleware.cors import CORSMiddleware


class Machine(SQLModel, table=True):
    id: int = Field(primary_key=True)
    network_machine_uid: str = Field(index=True)
    network_ip: str = Field(index=True)

    # now as default
    created_at: str = Field(
        default=datetime.datetime.now(datetime.timezone.utc), nullable=False
    )
    updated_at: str = Field(
        default=datetime.datetime.now(datetime.timezone.utc), nullable=False
    )


sqlite_file_name = "database.db"
sqlite_url = f"sqlite:///{sqlite_file_name}"

connect_args = {"check_same_thread": False}
engine = create_engine(sqlite_url, connect_args=connect_args)


def create_db_and_tables():
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session


SessionDep = Annotated[Session, Depends(get_session)]


app = FastAPI()

origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

redis_client = redis.Redis(host="redis", port=6379, db=0)


@app.on_event("startup")
def on_startup():
    create_db_and_tables()


@app.get("/")
def read_root():
    return {"message": "Welcome to the FastAPI service"}


class RegisterMachineRequest(BaseModel):
    network_ip: str


@app.post("/register/{machine_uid}")
def register_machine(
    machine_uid: str, request: RegisterMachineRequest, session: SessionDep
):
    existing_machine = session.exec(
        select(Machine).where(Machine.network_machine_uid == machine_uid)
    ).first()
    if existing_machine:
        raise HTTPException(status_code=400, detail="Machine already registered")

    new_machine = Machine(
        network_machine_uid=machine_uid,
        network_ip=request.network_ip,
    )
    session.add(new_machine)
    session.commit()
    session.refresh(new_machine)
    return {
        "machine_uid": machine_uid,
        "network_ip": request.network_ip,
        "status": "registered",
    }


@app.get("/liveness/{machine_uid}")
def check_liveness(machine_uid: str, session: SessionDep):
    machine = session.exec(
        select(Machine).where(Machine.network_machine_uid == machine_uid)
    ).first()
    if not machine:
        raise HTTPException(status_code=404, detail="Machine not found")

    status = redis_client.get(machine.id)
    if status:
        return {"machine_uid": machine_uid, "status": "online"}
    else:
        return {"machine_uid": machine_uid, "status": "offline"}


@app.post("/liveness/{machine_uid}")
def set_liveness(machine_uid: str, session: SessionDep):
    redis_client.setex(machine_uid, 6, "true")
    return {"machine_uid": machine_uid, "status": "online"}


@app.get("/machines")
def list_all_machines(session: SessionDep):
    machines = session.exec(select(Machine)).all()
    machine_list = []
    for machine in machines:
        status = redis_client.get(machine.network_machine_uid)
        machine_list.append(
            {
                "machine_uid": machine.network_machine_uid,
                "network_ip": machine.network_ip,
                "status": "online" if status else "offline",
            }
        )
    return machine_list


@app.get("/machines/online")
def list_online_machines():
    machine_ids = [key.decode("utf-8") for key in redis_client.keys()]
    online_machines = [{"machine_uid": machine_id} for machine_id in machine_ids]
    return online_machines


@app.post("/e/{rest_of_path:path}")
async def eval_proxy(request: Request):
    machine_ids = [key.decode("utf-8") for key in redis_client.keys()]
    if not machine_ids:
        raise HTTPException(status_code=404, detail="No online machines available")

    random_machine_id = random.choice(machine_ids)
    session = next(get_session())
    machine = session.exec(
        select(Machine).where(Machine.network_machine_uid == random_machine_id)
    ).first()
    if not machine:
        raise HTTPException(status_code=404, detail="Machine not found")

    # remove /e from beginning
    urlPath = request.url.path[2:]

    proxy_url = f"http://{machine.network_ip}:34523{urlPath}"

    async with httpx.AsyncClient() as client:
        response = await client.request(
            method=request.method,
            url=proxy_url,
            headers=request.headers,
            content=await request.body(),
        )

    return Response(
        content=response.text,
        status_code=response.status_code,
        headers=dict(response.headers),
    )
