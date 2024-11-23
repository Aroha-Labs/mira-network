from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import PlainTextResponse
import csv
import uvicorn
import io
from typing import List, Dict
from pydantic import BaseModel
from eval import evaluate_model
import os
import asyncio
import httpx
import logging
import requests

logging.basicConfig(level=logging.INFO)


model_providers = {
    "openai": {
        "base_url": "https://api.openai.com/v1",
        "api_key": os.getenv("OPENAI_API_KEY"),
    },
    "openrouter": {
        "base_url": "https://openrouter.ai/api/v1",
        "api_key": os.getenv("OPENROUTER_API_KEY"),
    },
    "anthropic": {
        "base_url": "https://api.anthropic.com/v1",
        "api_key": os.getenv("ANTHROPIC_API_KEY"),
    },
}


app = FastAPI()


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


# class ModelProvider(BaseModel):
#     base_url: str
#     api_key: str


# class AiRequest(BaseModel):
#     prompt: str = None
#     model: str = None
#     model_provider: Optional[ModelProvider] = None


@app.post("/v1/ai/{full_path:path}")
async def generate(req: Request, full_path: str):
    body = await req.json()

    prompt = body.get("prompt")
    model = body.get("model")
    model_provider = body.get("model_provider")

    if not model:
        raise HTTPException(status_code=400, detail="Model is required")

    if not prompt:
        raise HTTPException(status_code=400, detail="Prompt is required")

    if model_provider is None:
        model_parts = model.split("/", 1)
        if len(model_parts) < 2:
            raise HTTPException(status_code=400, detail="Invalid model name")

        provider_name = model_parts[0]
        model = model_parts[1]

        model_provider = model_providers.get(provider_name)

        if model_provider is None:
            raise HTTPException(status_code=400, detail="Invalid model provider")

    # curl https://api.openai.com/v1/chat/completions \
    #     -H "Content-Type: application/json" \
    #     -H "Authorization: Bearer $OPENAI_API_KEY" \
    #     -d '{
    #         "model": "gpt-4o-mini",
    #         "messages": [{"role": "user", "content": "Say this is a test!"}],
    #         "temperature": 0.7
    #     }'

    # url = model_provider.get("base_url") + "/chat/completions"
    # api_key = model_provider.get("api_key")

    url = "http://172.25.208.199:11434/v1/chat/completions"
    api_key = "sk-test"

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
    }
    data = {
        "model": "llama3.1",
        "messages": [{"role": "user", "content": prompt}],
    }

    # r = requests.post(url, headers=headers, json=data)
    # r.raise_for_status()
    # return r.json()

    re = requests.post(url, headers=headers, json=data)

    if re.status_code == 200:
        return re.json()
    else:
        print(f"Error: {re.status_code}")
        return re.text

    # async with httpx.AsyncClient() as client:
    #     response = await client.post(url, headers=headers, json=data)
    #     response.raise_for_status()
    #     return response.text()


async def update_liveness(machine_uid: str):
    url = f"https://mira-client-balancer.arohalabs.dev/liveness/{machine_uid}"
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
        await asyncio.sleep(5)


@app.on_event("startup")
async def startup_event():
    machine_uid = os.getenv("MC_MACHINE_ID")
    asyncio.create_task(update_liveness(machine_uid))


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
