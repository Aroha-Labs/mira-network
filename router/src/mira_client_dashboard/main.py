import random
from typing import Annotated, Optional
import datetime

from fastapi import Depends, FastAPI, HTTPException, Response
from pydantic import BaseModel
from sqlmodel import Field, Session, SQLModel, create_engine, select
import redis
import requests
from fastapi.middleware.cors import CORSMiddleware
import time
import httpx


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


@app.get("/health")
def health_check():
    return {"status": "ok"}


class RegisterMachineRequest(BaseModel):
    network_ip: str


def get_online_machines() -> list[str]:
    return [
        key.decode("utf-8").split(":")[1]
        for key in redis_client.keys(pattern="liveness:*")
    ]


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
    now = time.time()
    redis_client.setnx(f"liveness-start:{machine_uid}", now)
    created_at = float(redis_client.get(f"liveness-start:{machine_uid}"))
    ttl = int((now - created_at) + 12)
    redis_client.expire(f"liveness-start:{machine_uid}", ttl)

    network_ip = redis_client.get(f"network_ip:{machine_uid}")
    if not network_ip:
        machine = session.exec(
            select(Machine).where(Machine.network_machine_uid == machine_uid)
        ).first()
        if not machine:
            raise HTTPException(status_code=404, detail="Machine not found")
        redis_client.set(f"network_ip:{machine_uid}", machine.network_ip)
        network_ip = machine.network_ip

    redis_client.hset(
        f"liveness:{machine_uid}",
        mapping={
            "network_ip": network_ip,
            "timestamp": now,
            "machine_uid": machine_uid,
        },
    )
    redis_client.expire(f"liveness:{machine_uid}", 6)

    return {"machine_uid": machine_uid, "status": "online"}


@app.get("/machines")
def list_all_machines(session: SessionDep):
    machines = session.exec(select(Machine)).all()
    online_machines = get_online_machines()

    return [
        {
            "machine_uid": machine.network_machine_uid,
            "network_ip": machine.network_ip,
            "status": (
                "online"
                if machine.network_machine_uid in online_machines
                else "offline"
            ),
        }
        for machine in machines
    ]


@app.get("/machines/online")
def list_online_machines():
    online_machines = get_online_machines()
    return [{"machine_uid": key} for key in online_machines]


class ModelProvider(BaseModel):
    base_url: str
    api_key: str


class AiRequest(BaseModel):
    prompt: str = Field(..., title="Prompt")
    model: str = Field("mira/llama3.1", title="Model")
    model_provider: Optional[ModelProvider] = Field(
        None, title="Model Provider (optional)"
    )


@app.post("/v1/generate")
async def generate(request: AiRequest):
    machine_ids = get_online_machines()
    if not machine_ids:
        raise HTTPException(status_code=404, detail="No online machines available")

    random_machine_id = random.choice(machine_ids)
    session = next(get_session())
    machine = session.exec(
        select(Machine).where(Machine.network_machine_uid == random_machine_id)
    ).first()
    if not machine:
        raise HTTPException(status_code=404, detail="Machine not found")

    proxy_url = f"http://{machine.network_ip}:34523/v1/generate"

    response = requests.post(
        proxy_url,
        json=request.model_dump(),
    )

    return Response(
        content=response.text,
        status_code=response.status_code,
        headers=dict(response.headers),
    )


class VerifyRequest(AiRequest):
    # prompt: str = Field(..., title="Prompt")
    # models: list[str] = Field(["mira/llama3.1"], title="Models")
    total_runs: int = Field(5, title="Total runs")
    min_yes: int = Field(3, title="Minimum yes")


@app.post("/v1/verify")
async def verify(req: VerifyRequest, session: SessionDep):
    if req.total_runs < 1:
        raise HTTPException(status_code=400, detail="Total runs must be at least 1")

    if req.min_yes < 1:
        raise HTTPException(status_code=400, detail="Minimum yes must be at least 1")

    if req.min_yes > req.total_runs:
        raise HTTPException(
            status_code=400, detail="Minimum yes must be less than total runs"
        )

    machine_ids = get_online_machines()
    if not machine_ids:
        raise HTTPException(status_code=404, detail="No online machines available")

    if len(machine_ids) < req.total_runs:
        raise HTTPException(
            status_code=400,
            detail=f"Not enough online machines for total runs, we have {len(machine_ids)} online machines",
        )

    selected_machines = random.sample(machine_ids, req.total_runs)
    selected_ips = redis_client.mget(
        [f"network_ip:{machine_id}" for machine_id in selected_machines]
    )
    ips = [ip.decode("utf-8") for ip in selected_ips]

    print("=====>", selected_machines, ips)

    if len(selected_machines) != len(ips):
        raise HTTPException(status_code=400, detail="Machine not found")

    results = []
    async with httpx.AsyncClient() as client:
        for ip in ips:
            proxy_url = f"http://{ip}:34523/v1/verify"
            response = await client.post(
                proxy_url,
                json={
                    "prompt": req.prompt,
                    "model": req.model,
                    "model_provider": req.model_provider,
                },
            )
            results.append({"machine_ip": ip, "result": response.json()["result"]})

    # for ip in ips:
    #     proxy_url = f"http://{ip}:34523/v1/verify"
    #     response = requests.post(
    #         proxy_url,
    #         json={
    #             "prompt": req.prompt,
    #             "model": req.model,
    #             "model_provider": req.model_provider,
    #         },
    #     )

    #     if not response.ok:
    #         raise HTTPException(
    #             status_code=500, detail=f"Error from machine {ip}: {response.text}"
    #         )

    #     results.append({"machine_ip": ip, "result": response.json()["result"]})

    yes_count = sum(1 for result in results if result["result"] == "yes")
    if yes_count >= req.min_yes:
        return {"result": "yes", "results": results}
    else:
        return {"result": "no", "results": results}
