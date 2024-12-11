from fastapi import FastAPI, HTTPException
from fastapi.responses import PlainTextResponse
import csv
import uvicorn
import io
from typing import List, Dict, Optional
from pydantic import BaseModel, Field
from eval import evaluate_model
import os
import asyncio
import httpx
import logging
import requests
from fastapi.middleware.cors import CORSMiddleware
import json

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ROUTER_BASE_URL = os.getenv(
    "ROUTER_BASE_URL",
    "https://mira-client-balancer.alts.dev",
)

logging.basicConfig(level=logging.INFO)


class ModelProvider(BaseModel):
    base_url: str
    api_key: str


model_providers = {
    "openai": ModelProvider(
        base_url="https://api.openai.com/v1",
        api_key=os.getenv("OPENAI_API_KEY"),
    ),
    "openrouter": ModelProvider(
        base_url="https://openrouter.ai/api/v1",
        api_key=os.getenv("OPENROUTER_API_KEY"),
    ),
    "anthropic": ModelProvider(
        base_url="https://api.anthropic.com/v1",
        api_key=os.getenv("ANTHROPIC_API_KEY"),
    ),
    "mira": ModelProvider(
        base_url="https://ollama.alts.dev/v1",
        api_key=os.getenv("MIRA_API_KEY"),
    ),
}


class Message(BaseModel):
    role: str
    content: str


def get_model_provider(
    model: str,
    model_provider: ModelProvider | None,
) -> tuple[ModelProvider, str]:
    if model == "":
        raise HTTPException(status_code=400, detail="Model is required")

    if model_provider is not None:
        return model_provider, model

    provider_name, model_name = model.split("/", 1)

    if not model_name or model_name == "":
        raise HTTPException(status_code=400, detail="Invalid model name")

    if provider_name not in model_providers:
        raise HTTPException(status_code=400, detail="Invalid model provider")

    return model_providers[provider_name], model_name


def get_llm_completion(
    model: str,
    model_provider: ModelProvider,
    messages: list[Message],
):
    req = requests.post(
        url=f"{model_provider.base_url}/chat/completions",
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {model_provider.api_key}",
        },
        json={
            "model": model,
            "messages": [
                {"role": msg["role"], "content": msg["content"]} for msg in messages
            ],
        },
    )

    if req.ok != True:
        print(f"Error: {req.status_code}")
        raise HTTPException(status_code=req.status_code, detail=req.text)

    return req.json()


@app.get("/health")
async def health() -> Dict[str, str]:
    return {"status": "healthy"}


class EvaluationRequest(BaseModel):
    csv: str
    models: List[str]
    eval_system_prompt: str


@app.post("/v1/eval", response_class=PlainTextResponse)
async def evaluate(req: EvaluationRequest) -> str:
    csv_string = req.csv
    models = req.models

    if not csv_string or not models:
        raise HTTPException(status_code=400, detail="Invalid input")

    # Parse the CSV string
    csv_reader = csv.reader(io.StringIO(csv_string))
    headers: List[str] = next(csv_reader)
    rows: List[List[str]] = list(csv_reader)

    # Prepare the result CSV
    output = io.StringIO()
    csv_writer = csv.writer(output)
    result_headers: List[str] = headers + models
    csv_writer.writerow(result_headers)

    # Evaluate each prompt against each model
    for row in rows:
        for model in models:
            result: str = evaluate_model(
                {
                    "headers": headers,
                    "row": row,
                    "model": model,
                    "eval_system_prompt": req.eval_system_prompt,
                }
            )
            row.append(result)
        csv_writer.writerow(row)

    return output.getvalue()


class AiRequest(BaseModel):
    model: str = Field(title="Model", default="")
    model_provider: Optional[ModelProvider] = Field(None, title="Model Provider")
    messages: List[Message] = Field(None, title="Chat History")


@app.post("/v1/chat/completions")
async def generate(req: AiRequest):
    if not req.messages or not any(msg.role == "user" for msg in req.messages):
        raise HTTPException(
            status_code=400, detail="At least one user message is required"
        )

    model_provider, model = get_model_provider(req.model, req.model_provider)

    # Convert Message objects to dictionaries
    messages = [{"role": msg.role, "content": msg.content} for msg in req.messages]

    return get_llm_completion(
        model,
        model_provider,
        messages=messages,
    )


@app.get("/v1/models", tags=["network"])
async def list_models():
    file_path = os.path.join(
        os.path.dirname(__file__), "../router/supported-models.json"
    )

    with open(file_path, "r") as f:
        supported_models: list[str] = json.load(f)

    return {
        "object": "list",
        "data": [{"id": model, "object": "model"} for model in supported_models],
    }


class VerifyRequest(BaseModel):
    model: str = Field(title="Model", default="mira/llama3.1")
    model_provider: Optional[ModelProvider] = Field(None, title="Model Provider")
    messages: List[Message] = Field([], title="Chat History")


@app.post("/v1/verify")
async def verify(req: VerifyRequest):
    if not req.messages:
        raise HTTPException(status_code=400, detail="At least one message is required")

    # message with role=system shouldn't be present
    if any(msg.role == "system" for msg in req.messages):
        raise HTTPException(status_code=400, detail="System message is not allowed")

    system_message = Message(
        role="system",
        content="""You verify user message with `yes` or `no`.
                Don't be verbose.
                Don't ask questions.
                Don't provide explanations.
                Don't provide suggestions.
                Don't provide opinions.
                Don't provide additional information.

                you only need to verify the user message.
                you only reply with `yes` or `no`.

                Example:
                User: India is a country.
                Assistant: yes

                User: Bangladesh is a continent.
                Assistant: no

                User: Delhi is capital of India.
                Assistant: yes

                User: who is the president of India?
                Assistant: no""",
    )

    model_provider, model = get_model_provider(req.model, req.model_provider)

    # Convert Message objects to dictionaries
    messages = [{"role": msg.role, "content": msg.content} for msg in req.messages]

    # prepend system message
    messages.insert(0, {"role": system_message.role, "content": system_message.content})

    res = get_llm_completion(
        model=model,
        model_provider=model_provider,
        messages=messages,
    )

    if res["choices"][0]["message"]["content"].lower() == "yes":
        return {"result": "yes"}
    else:
        return {"result": "no"}


async def update_liveness(machine_uid: str):
    url = f"{ROUTER_BASE_URL}/liveness/{machine_uid}"
    while True:
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(url)
                response.raise_for_status()
                logging.info(f"Liveness check successful for {machine_uid}")
            except httpx.HTTPStatusError as exc:
                logging.error(
                    f"HTTP error occurred: {exc.response.status_code} - {exc.response.text}"
                )
            except Exception as exc:
                logging.error(f"An error occurred: {exc}")
        await asyncio.sleep(3)


@app.on_event("startup")
async def startup_event():
    machine_uid = os.getenv("MC_MACHINE_ID")
    asyncio.create_task(update_liveness(machine_uid))


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
