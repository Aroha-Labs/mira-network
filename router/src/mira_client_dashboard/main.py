import random
from typing import Annotated, Optional
import time
import os
import json
from datetime import datetime  # Add this import

from fastapi import Depends, FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse
from pydantic import BaseModel, Field
from sqlmodel import Session, select
import requests
import httpx
from prometheus_fastapi_instrumentator import Instrumentator
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from supabase import create_client, Client
from hashlib import md5

from .models import Machine, Flows, ApiLogs, ApiToken, UserCredits, UserCreditsHistory
from .db import create_db_and_tables, get_session
from .redis_client import redis_client, get_online_machines

from fastapi.openapi.models import OAuthFlows as OAuthFlowsModel
from fastapi.openapi.models import OAuth2 as OAuth2Model
from fastapi.openapi.models import OAuthFlowPassword as OAuthFlowPasswordModel
from fastapi.openapi.models import (
    OAuthFlowAuthorizationCode as OAuthFlowAuthorizationCodeModel,
)

oauth2_scheme = OAuth2Model(
    flows=OAuthFlowsModel(
        password=OAuthFlowPasswordModel(tokenUrl="token"),
        authorizationCode=OAuthFlowAuthorizationCodeModel(
            authorizationUrl="authorize", tokenUrl="token"
        ),
    )
)

app = FastAPI(
    title="Mira Client Dashboard",
    description="API documentation for Mira Client Dashboard",
    version="1.0.0",
    openapi_tags=[
        {"name": "network", "description": "Network related operations"},
        {"name": "tokens", "description": "API token management"},
        {"name": "logs", "description": "API logs"},
        {"name": "credits", "description": "User credits management"},
        {"name": "flows", "description": "Flow management"},
    ],
    openapi_url="/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc",
    swagger_ui_oauth2_redirect_url="/docs/oauth2-redirect",
    swagger_ui_init_oauth={
        "clientId": "your-client-id",
        "clientSecret": "your-client-secret",
        "realm": "your-realm",
        "appName": "Mira Client Dashboard",
        "scopeSeparator": " ",
        "scopes": {"read": "Read access", "write": "Write access"},
    },
)

instrumentator = Instrumentator().instrument(app)

SessionDep = Annotated[Session, Depends(get_session)]

origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

PROXY_PORT = 34523

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

security = HTTPBearer()


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
    instrumentator.expose(app)


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
    stream: Optional[bool] = Field(False, title="Stream")


def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    isJwtToken = len(token.split(".")) == 3

    if isJwtToken:
        response = supabase.auth.get_user(token)
        if response.user is not None:
            return response.user
        else:
            raise HTTPException(status_code=401, detail="Unauthorized access")

    session = next(get_session())
    api_token = session.exec(
        select(ApiToken).where(ApiToken.token == token, ApiToken.deleted_at.is_(None))
    ).first()

    if api_token is None:
        raise HTTPException(status_code=401, detail="Unauthorized access")

    user_response = supabase.auth.admin.get_user_by_id(api_token.user_id)
    if user_response.user is None:
        raise HTTPException(status_code=401, detail="Unauthorized access")

    return user_response.user


@app.post("/v1/chat/completions", tags=["network"])
async def generate(
    req: AiRequest,
    user=Depends(verify_token),
    db: Session = Depends(get_session),
) -> Response:
    timeStart = time.time()

    machine = get_random_machines(1)[0]
    proxy_url = f"http://{machine.network_ip}:{PROXY_PORT}/v1/chat/completions"
    llmres = requests.post(proxy_url, json=req.model_dump(), stream=req.stream)

    def generate():
        usage = {}
        result_text = ""
        for line in llmres.iter_lines():
            l = line.decode("utf-8")
            if l.startswith("data: "):
                l = l[6:]
            try:
                json_line = json.loads(l)
                if "choices" in json_line:
                    choice = json_line["choices"][0]
                    if "delta" in choice:
                        delta = choice["delta"]
                        if "content" in delta:
                            result_text += delta["content"]
                if "usage" in json_line:
                    usage = json_line["usage"]
            except json.JSONDecodeError as e:
                print(e)
            yield line

        # Log the request
        api_log = ApiLogs(
            user_id=user.id,
            payload=req.model_dump_json(),
            response=result_text,
            prompt_tokens=usage.get("prompt_tokens", 0),
            completion_tokens=usage.get("completion_tokens", 0),
            total_tokens=usage.get("total_tokens", 0),
            total_response_time=time.time() - timeStart,
            model=req.model,
        )

        db.add(api_log)

        # Calculate cost and reduce user credits
        total_tokens = usage.get("total_tokens", 0)
        cost = total_tokens * 0.0003
        user_credits = db.exec(
            select(UserCredits).where(UserCredits.user_id == user.id)
        ).first()
        if user_credits:
            user_credits.credits -= cost
            db.add(user_credits)

            # Update user credit history
            user_credits_history = UserCreditsHistory(
                user_id=user.id,
                amount=-cost,
                description=f"Used {total_tokens} tokens",
            )
            db.add(user_credits_history)

        db.commit()

    res = StreamingResponse(generate(), media_type="text/event-stream")

    return res


class VerifyRequest(BaseModel):
    messages: list[Message] = Field([], title="Messages")
    models: list[str] = Field(["mira/llama3.1"], title="Models")
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
            proxy_url = f"http://{machine.network_ip}:{PROXY_PORT}/v1/verify"
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
                    "response": response_data,
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
    proxy_url = f"http://{machine.network_ip}:{PROXY_PORT}/v1/chat/completions"
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


@app.get("/api-logs", tags=["logs"])
def list_all_logs(
    db: Session = Depends(get_session),
    user=Depends(verify_token),
    page: int = 1,
    page_size: int = 10,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    order_by: Optional[str] = "created_at",
    order: Optional[str] = "desc",
):
    offset = (page - 1) * page_size
    query = db.query(ApiLogs).filter(ApiLogs.user_id == user.id)

    if start_date:
        query = query.filter(ApiLogs.created_at >= start_date)
    if end_date:
        query = query.filter(ApiLogs.created_at <= end_date)

    if order_by not in ["created_at", "total_response_time", "total_tokens"]:
        raise HTTPException(status_code=400, detail="Invalid order_by field")

    if order == "desc":
        query = query.order_by(getattr(ApiLogs, order_by).desc())
    elif order == "asc":
        query = query.order_by(getattr(ApiLogs, order_by).asc())
    else:
        raise HTTPException(status_code=400, detail="Invalid order direction")

    logs = query.offset(offset).limit(page_size).all()
    total_logs = query.count()
    return {
        "logs": logs,
        "total": total_logs,
        "page": page,
        "page_size": page_size,
    }


class ApiTokenRequest(BaseModel):
    description: Optional[str] = None


@app.post("/api-tokens", tags=["tokens"])
def create_api_token(
    request: ApiTokenRequest,
    db: Session = Depends(get_session),
    user=Depends(verify_token),
):
    token = f"sk-mira-{os.urandom(24).hex()}"
    api_token = ApiToken(user_id=user.id, token=token, description=request.description)
    db.add(api_token)
    db.commit()
    db.refresh(api_token)
    return {
        "token": api_token.token,
        "description": api_token.description,
        "created_at": api_token.created_at,
    }


@app.get("/api-tokens", tags=["tokens"])
def list_api_tokens(db: Session = Depends(get_session), user=Depends(verify_token)):
    tokens = (
        db.query(ApiToken)
        .filter(ApiToken.user_id == user.id, ApiToken.deleted_at.is_(None))
        .all()
    )
    return [
        {
            "token": token.token,
            "description": token.description,
            "created_at": token.created_at,
        }
        for token in tokens
    ]


@app.delete("/api-tokens/{token}", tags=["tokens"])
def delete_api_token(
    token: str, db: Session = Depends(get_session), user=Depends(verify_token)
):
    api_token = (
        db.query(ApiToken)
        .filter(ApiToken.token == token, ApiToken.user_id == user.id)
        .first()
    )
    if not api_token:
        raise HTTPException(status_code=404, detail="Token not found")

    api_token.deleted_at = datetime.utcnow()
    db.commit()
    db.refresh(api_token)
    return {"message": "Token deleted successfully"}


@app.get("/total-inference-calls", tags=["logs"])
def total_inference_calls(
    db: Session = Depends(get_session), user=Depends(verify_token)
):
    logs = db.query(ApiLogs).filter(ApiLogs.user_id == user.id).all()
    return len(logs)


class AddCreditRequest(BaseModel):
    user_id: str
    amount: float
    description: Optional[str] = None


@app.post("/add-credit", tags=["credits"])
def add_credit(request: AddCreditRequest, db: Session = Depends(get_session)):
    user_credits = db.exec(
        select(UserCredits).where(UserCredits.user_id == request.user_id)
    ).first()

    if user_credits is None:
        user_credits = UserCredits(
            user_id=request.user_id,
            credits=request.amount,
        )
        db.add(user_credits)
    else:
        user_credits.credits += request.amount

    # Update user credit history
    user_credits_history = UserCreditsHistory(
        user_id=request.user_id,
        amount=request.amount,
        description=request.description,
    )
    db.add(user_credits_history)

    db.commit()
    db.refresh(user_credits)
    return {
        "user_id": user_credits.user_id,
        "credits": user_credits.credits,
        "updated_at": user_credits.updated_at,
    }


@app.get("/user-credits", tags=["credits"])
def get_user_credits(user=Depends(verify_token), db: Session = Depends(get_session)):
    user_credits = db.exec(
        select(UserCredits).where(UserCredits.user_id == user.id)
    ).first()

    if user_credits is None:
        return {
            "user_id": user.id,
            "credits": 0.0,
            "updated_at": None,
        }

    return {
        "user_id": user_credits.user_id,
        "credits": user_credits.credits,
        "updated_at": user_credits.updated_at,
    }


@app.get("/user-credits-history", tags=["credits"])
def get_user_credits_history(
    user=Depends(verify_token), db: Session = Depends(get_session)
):
    user_credits_history = db.exec(
        select(UserCreditsHistory).where(UserCreditsHistory.user_id == user.id)
    ).all()

    return user_credits_history


IMAGE_CACHE_DIR = "image_cache"
os.makedirs(IMAGE_CACHE_DIR, exist_ok=True)


@app.get("/proxy-image")
async def proxy_image(url: str):
    # Generate a unique filename based on the URL
    filename = md5(url.encode()).hexdigest()
    filepath = os.path.join(IMAGE_CACHE_DIR, filename)

    # Check if the image is already cached
    if os.path.exists(filepath):
        return FileResponse(
            filepath, headers={"Cache-Control": "public, max-age=31536000"}
        )

    # Download the image and save it to the cache
    async with httpx.AsyncClient() as client:
        response = await client.get(url)
        if response.status_code != 200:
            raise HTTPException(
                status_code=response.status_code, detail="Failed to fetch image"
            )

        # Determine the file extension from the response headers
        content_type = response.headers.get("content-type")
        if content_type:
            extension = content_type.split("/")[-1]
            filepath += f".{extension}"

        with open(filepath, "wb") as f:
            f.write(response.content)

    return FileResponse(filepath, headers={"Cache-Control": "public, max-age=31536000"})
