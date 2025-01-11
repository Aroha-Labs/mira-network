import re
from typing import Any, Dict, List
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlmodel import Session, select
from src.router.api.v1.network import generate
from src.router.core.security import verify_user
from src.router.core.types import User
from src.router.schemas.ai import AiRequest, Message
from src.router.models.flows import Flows
from src.router.schemas.flows import FlowRequest, FlowChatCompletion
from src.router.db.session import get_session
from src.router.utils.network import get_random_machines, PROXY_PORT
import requests

router = APIRouter()


def extract_variables(system_prompt: str) -> List[str]:
    # get variables from system prompt which are in the form of {{variable_name}}
    variables = re.findall(r"\{\{([^}]+)\}\}", system_prompt)
    return variables


@router.post("/flows")
def create_flow(flow: FlowRequest, db: Session = Depends(get_session)):
    variables = extract_variables(flow.system_prompt)

    new_flow = Flows(
        system_prompt=flow.system_prompt,
        name=flow.name,
        variables=variables,
    )
    db.add(new_flow)
    db.commit()
    db.refresh(new_flow)
    return new_flow


@router.get("/flows")
def list_all_flows(db: Session = Depends(get_session)):
    flows = db.query(Flows).all()
    return flows


@router.get("/flows/{flow_id}")
def get_flow(flow_id: str, db: Session = Depends(get_session)):
    flow = db.exec(select(Flows).where(Flows.id == flow_id)).first()
    if not flow:
        raise HTTPException(status_code=404, detail="Flow not found")
    return flow


@router.put("/flows/{flow_id}")
def update_flow(flow_id: str, flow: FlowRequest, db: Session = Depends(get_session)):
    existing_flow = db.query(Flows).filter(Flows.id == flow_id).first()
    if not existing_flow:
        raise HTTPException(status_code=404, detail="Flow not found")

    existing_flow.system_prompt = flow.system_prompt
    existing_flow.name = flow.name

    db.commit()
    db.refresh(existing_flow)
    return existing_flow


@router.delete("/flows/{flow_id}")
def delete_flow(flow_id: str, db: Session = Depends(get_session)):
    existing_flow = db.query(Flows).filter(Flows.id == flow_id).first()
    if not existing_flow:
        raise HTTPException(status_code=404, detail="Flow not found")

    db.delete(existing_flow)
    db.commit()
    return {"message": "Flow deleted successfully"}


@router.post("/v1/flow/{flow_id}/chat/completions")
async def generate_with_flow_id(
    flow_id: str,
    req: FlowChatCompletion,
    db: Session = Depends(get_session),
    user: User = Depends(verify_user),
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
    required_vars = flow.variables

    if required_vars:
        if req.variables is None:
            raise HTTPException(
                status_code=400, detail="Variables are required but none were provided"
            )
        missing_vars = [var for var in required_vars if var not in req.variables]
        if missing_vars:
            raise HTTPException(
                status_code=400,
                detail=f"Missing required variables: {', '.join(missing_vars)}",
            )

        for var in required_vars:
            system_prompt = system_prompt.replace(
                f"{{{{{var}}}}}", str(req.variables[var])
            )

    req.messages.insert(0, Message(role="system", content=system_prompt))

    machine = get_random_machines(1)[0]
    # proxy_url = f"http://{machine.network_ip}:{PROXY_PORT}/v1/chat/completions"

    response = await generate(
        req=AiRequest(
            model=req.model,
            messages=req.messages,
            stream=req.stream,
            model_provider=None,
        ),
        user=user,
        db=db,
    )

    return response


@router.post("/flows/try")
async def try_flow(
    req: FlowRequest,
    chat: FlowChatCompletion,
    user: User = Depends(verify_user),
    db: Session = Depends(get_session),
):
    # Extract variables from the system prompt
    variables = extract_variables(req.system_prompt)

    if variables:
        if chat.variables is None:
            raise HTTPException(
                status_code=400, detail="Variables are required but none were provided"
            )
        missing_vars = [var for var in variables if var not in chat.variables]
        if missing_vars:
            raise HTTPException(
                status_code=400,
                detail=f"Missing required variables: {', '.join(missing_vars)}",
            )

        system_prompt = req.system_prompt
        for var in variables:
            system_prompt = system_prompt.replace(
                f"{{{{{var}}}}}", str(chat.variables[var])
            )
    else:
        system_prompt = req.system_prompt

    chat.messages.insert(0, Message(role="system", content=system_prompt))

    print(chat.messages)

    response = await generate(
        req=AiRequest(
            model=chat.model,
            messages=chat.messages,
            stream=chat.stream,
            model_provider=None,
        ),
        user=user,
        db=db,
    )

    return response
