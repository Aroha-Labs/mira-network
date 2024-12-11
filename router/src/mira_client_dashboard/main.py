import random
from typing import Annotated, Optional
import datetime

from fastapi import Depends, FastAPI, HTTPException, Response
from pydantic import BaseModel, Field
from sqlmodel import Field as SQLField, Session, SQLModel, create_engine, select
import redis
import requests
from fastapi.middleware.cors import CORSMiddleware
import time
import httpx
import os
import json


class Machine(SQLModel, table=True):
    id: int = SQLField(primary_key=True)
    network_machine_uid: str = SQLField(index=True)
    network_ip: str = SQLField(index=True)

    # now as default
    created_at: str = SQLField(
        default=datetime.datetime.now(datetime.timezone.utc), nullable=False
    )
    updated_at: str = SQLField(
        default=datetime.datetime.now(datetime.timezone.utc), nullable=False
    )


class Flows(SQLModel, table=True):
    id: int = SQLField(primary_key=True)
    system_prompt: str = SQLField(nullable=False)
    name: str = SQLField(nullable=False, unique=True)

    # now as default
    created_at: str = SQLField(
        default=datetime.datetime.now(datetime.timezone.utc), nullable=False
    )
    updated_at: str = SQLField(
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


def get_online_machines() -> list[str]:
    return [
        key.decode("utf-8").split(":")[1]
        for key in redis_client.keys(pattern="liveness:*")
    ]


class MachineInfo(BaseModel):
    machine_uid: str
    network_ip: str


def get_random_machines(number_of_machines: int = 1) -> list[MachineInfo]:
    machine_ids = get_online_machines()
    if not machine_ids:
        raise HTTPException(status_code=404, detail="No online machines available")

    if number_of_machines > len(machine_ids):
        raise HTTPException(
            status_code=404,
            detail=f"Not enough online machines available, we have {len(machine_ids)} online machines",
        )

    random_machine_ids = random.sample(machine_ids, number_of_machines)

    # get machine ips
    network_ips = redis_client.mget(
        [f"network_ip:{machine_id}" for machine_id in random_machine_ids]
    )

    if len(random_machine_ids) != len(network_ips):
        raise HTTPException(status_code=404, detail="Machine not found")

    return [
        MachineInfo(machine_uid=machine_id, network_ip=network_ip.decode("utf-8"))
        for machine_id, network_ip in zip(random_machine_ids, network_ips)
    ]


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


class Message(BaseModel):
    role: str
    content: str


class ModelProvider(BaseModel):
    base_url: str
    api_key: str


@app.get("/v1/models", tags=["network"])
async def list_models():
    file_path = os.path.join(os.path.dirname(__file__), "../../supported-models.json")

    with open(file_path, "r") as f:
        supported_models: list[str] = json.load(f)

    return {
        "object": "list",
        "data": [{"id": model, "object": "model"} for model in supported_models],
    }


class AiRequest(BaseModel):
    model: str = Field("mira/llama3.1", title="Model")
    model_provider: Optional[ModelProvider] = Field(
        None, title="Model Provider (optional)"
    )
    messages: list[Message] = Field([], title="Messages")


@app.post("/v1/chat/completions", tags=["network"])
async def generate(request: AiRequest):
    machine = get_random_machines(1)[0]
    proxy_url = f"http://{machine.network_ip}:34523/v1/chat/completions"
    response = requests.post(proxy_url, json=request.model_dump())

    return Response(
        content=response.text,
        status_code=response.status_code,
        headers=dict(response.headers),
    )


class VerifyRequest(BaseModel):
    messages: list[Message] = Field([], title="Messages")
    models: list[str] = Field(["mira/llama3.1"], title="Models")
    # total_runs: int = Field(5, title="Total runs")
    min_yes: int = Field(3, title="Minimum yes")


@app.post("/v1/verify", tags=["network"])
async def verify(req: VerifyRequest):
    if len(req.models) < 1:
        raise HTTPException(status_code=400, detail="At least one model is required")

    if req.min_yes < 1:
        raise HTTPException(status_code=400, detail="Minimum yes must be at least 1")

    if req.min_yes > len(req.models):
        raise HTTPException(
            status_code=400,
            detail="Minimum yes must be less than or equal to the number of models",
        )

    machines = get_random_machines(len(req.models))

    results = []
    async with httpx.AsyncClient() as client:
        for idx, machine in enumerate(machines):
            proxy_url = f"http://{machine.network_ip}:34523/v1/verify"
            response = await client.post(
                proxy_url,
                json={
                    "messages": [
                        {"role": msg.role, "content": msg.content}
                        for msg in req.messages
                    ],
                    "model": req.models[idx],
                },
            )
            response_data = response.json()
            results.append(
                {
                    "machine": machine.model_dump(),
                    "result": response_data["result"],
                }
            )

    yes_count = sum(1 for result in results if result["result"] == "yes")
    if yes_count >= req.min_yes:
        return {"result": "yes", "results": results}
    else:
        return {"result": "no", "results": results}


class FlowChatCompletion(AiRequest):
    variables: dict | None = Field(title="Variables", default=None)


@app.post("/v1/flow/{flow_id}/chat/completions", tags=["network"])
async def generate_with_flow_id(
    flow_id: str, req: FlowChatCompletion, db: Session = Depends(get_session)
):
    if any(msg.role == "system" for msg in req.messages):
        raise HTTPException(
            status_code=400,
            detail="System message is not allowed in request",
        )

    flow = db.exec(select(Flows).where(Flows.id == flow_id)).first()
    if not flow:
        raise HTTPException(status_code=404, detail="Flow not found")

    system_prompt = flow.system_prompt

    # Extract variables from system_prompt
    def extract_variables(prompt):
        # Use regex to find all text within {}
        import re

        pattern = r"\{([^}]+)\}"
        variables = re.findall(pattern, prompt)
        return variables

    # Get required variables
    required_vars = extract_variables(system_prompt)

    if required_vars:  # Only check if there are variables to verify
        if req.variables is None:
            raise ValueError("Variables are required but none were provided")
        missing_vars = [var for var in required_vars if var not in req.variables]
        if missing_vars:
            raise ValueError(f"Missing required variables: {', '.join(missing_vars)}")

        # Replace variables in system_prompt
        for var in required_vars:
            system_prompt = system_prompt.replace(f"{{{var}}}", str(req.variables[var]))

    # Now system_prompt has all variables replaced
    req.messages.insert(0, Message(role="system", content=system_prompt))

    machine = get_random_machines(1)[0]
    proxy_url = f"http://{machine.network_ip}:34523/v1/chat/completions"
    response = requests.post(proxy_url, json=req.model_dump())

    return Response(
        content=response.text,
        status_code=response.status_code,
        headers=dict(response.headers),
    )


@app.get("/flows", tags=["flows"])
def list_all_flows(db: Session = Depends(get_session)):
    flows = db.query(Flows).all()
    return flows


@app.get("/flows/{flow_id}", tags=["flows"])
def get_flow(flow_id: str, db: Session = Depends(get_session)):
    flow = db.exec(select(Flows).where(Flows.id == flow_id)).first()
    if not flow:
        raise HTTPException(status_code=404, detail="Flow not found")
    return flow


class FlowRequest(BaseModel):
    system_prompt: str
    name: str


@app.post("/flows", tags=["flows"])
def create_flow(flow: FlowRequest, db: Session = Depends(get_session)):
    new_flow = Flows(
        system_prompt=flow.system_prompt,
        name=flow.name,
    )
    db.add(new_flow)
    db.commit()
    db.refresh(new_flow)
    return new_flow


@app.put("/flows/{flow_id}", tags=["flows"])
def update_flow(flow_id: str, flow: FlowRequest, db: Session = Depends(get_session)):
    existing_flow = db.query(Flows).filter(Flows.id == flow_id).first()
    if not existing_flow:
        raise HTTPException(status_code=404, detail="Flow not found")

    existing_flow.system_prompt = flow.system_prompt
    existing_flow.name = flow.name

    db.commit()
    db.refresh(existing_flow)
    return existing_flow


@app.delete("/flows/{flow_id}", tags=["flows"])
def delete_flow(flow_id: str, db: Session = Depends(get_session)):
    existing_flow = db.query(Flows).filter(Flows.id == flow_id).first()
    if not existing_flow:
        raise HTTPException(status_code=404, detail="Flow not found")

    db.delete(existing_flow)
    db.commit()
    return {"message": "Flow deleted successfully"}


class FlowUpdateRequest(BaseModel):
    system_prompt: str | None = Field(None, title="System Prompt")
    name: str | None = Field(None, title="Name")


@app.patch("/flows/{flow_id}", tags=["flows"])
def update_flow(flow_id: str, flow: FlowRequest, db: Session = Depends(get_session)):
    existing_flow = db.query(Flows).filter(Flows.id == flow_id).first()
    if not existing_flow:
        raise HTTPException(status_code=404, detail="Flow not found")

    if flow.system_prompt is not None:
        existing_flow.system_prompt = flow.system_prompt

    if flow.name is not None:
        existing_flow.name = flow.name

    db.commit()
    db.refresh(existing_flow)
    return existing_flow
