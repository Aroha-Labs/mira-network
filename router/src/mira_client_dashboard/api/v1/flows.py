from fastapi import APIRouter, Depends, HTTPException, Response
from sqlmodel import Session, select
from src.mira_client_dashboard.models.flows import Flows
from src.mira_client_dashboard.schemas.flows import FlowRequest, FlowChatCompletion
from src.mira_client_dashboard.db.session import get_session
from src.mira_client_dashboard.core.security import verify_token
from src.mira_client_dashboard.utils.helpers import extract_variables
from src.mira_client_dashboard.utils.network import get_random_machines, PROXY_PORT
import requests

router = APIRouter()

@router.post("/flows")
def create_flow(flow: FlowRequest, db: Session = Depends(get_session)):
    print(flow.system_prompt)
    new_flow = Flows(
        system_prompt=flow.system_prompt,
        name=flow.name,
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
    db: Session = Depends(get_session)
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
    required_vars = extract_variables(system_prompt)

    if required_vars:
        if req.variables is None:
            raise ValueError("Variables are required but none were provided")
        missing_vars = [var for var in required_vars if var not in req.variables]
        if missing_vars:
            raise ValueError(f"Missing required variables: {', '.join(missing_vars)}")

        for var in required_vars:
            system_prompt = system_prompt.replace(f"{{{var}}}", str(req.variables[var]))

    req.messages.insert(0, {"role": "system", "content": system_prompt})

    machine = get_random_machines(1)[0]
    proxy_url = f"http://{machine.network_ip}:{PROXY_PORT}/v1/chat/completions"
    response = requests.post(proxy_url, json=req.model_dump())

    return Response(
        content=response.text,
        status_code=response.status_code,
        headers=dict(response.headers),
    )