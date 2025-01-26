from fastapi import FastAPI, HTTPException, Response
from fastapi.responses import PlainTextResponse, StreamingResponse
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
from fastapi.middleware.cors import CORSMiddleware
import json
import requests

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


class Message(BaseModel):
    role: str
    content: str

    def model_dump(self):
        return {"role": self.role, "content": self.content}


class FunctionCall(BaseModel):
    name: str
    arguments: str


class Function(BaseModel):
    name: str
    description: str
    parameters: dict = Field(
        default_factory=lambda: {"type": "object", "properties": {}, "required": []}
    )

    def dict(self):
        return {
            "name": self.name,
            "description": self.description,
            "parameters": self.parameters,
        }


class Tool(BaseModel):
    type: str = "function"
    function: Function

    def model_dump(self):
        return {"type": self.type, "function": self.function.dict()}


class ModelProvider(BaseModel):
    base_url: str
    api_key: str
    provider_name: str


class AiRequest(BaseModel):
    model: str = Field(title="Model", default="")
    model_provider: Optional[ModelProvider] = Field(None, title="Model Provider")
    messages: List[Message] = Field(None, title="Chat History")
    stream: Optional[bool] = Field(False, title="Stream")
    tools: Optional[list[Tool]] = Field(None, title="Tools")
    tool_choice: Optional[str] = Field("auto", title="Tool Choice")


model_providers = {
    "openai": ModelProvider(
        base_url="https://api.openai.com/v1",
        api_key=os.getenv("OPENAI_API_KEY"),
        provider_name="openai",
    ),
    "openrouter": ModelProvider(
        base_url="https://openrouter.ai/api/v1",
        api_key=os.getenv("OPENROUTER_API_KEY"),
        provider_name="openrouter",
    ),
    "anthropic": ModelProvider(
        base_url="https://api.anthropic.com/v1",
        api_key=os.getenv("ANTHROPIC_API_KEY"),
        provider_name="anthropic",
    ),
    "mira": ModelProvider(
        base_url=os.getenv("MIRA_BASE_URL", "https://ollama.alts.dev/v1"),
        api_key=os.getenv("MIRA_API_KEY"),
        provider_name="mira",
    ),
}


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
    stream: bool = False,
    tools: list[Tool] = None,
    tool_choice: str = "auto",
):
    """
    Get completion from LLM with support for function/tool calling across different providers
    """
    payload = {
        "model": model,
        "messages": [msg.model_dump() for msg in messages],
        "stream": stream,
    }

    # Add tools/functions if provided
    if tools:
        if model_provider.provider_name == "anthropic":
            # Convert OpenAI tool format to Anthropic's format
            payload["tools"] = [tool.model_dump() for tool in tools]
        # elif model_provider.provider_name == "google":
        #     # Convert OpenAI tool format to Google's format
        #     payload["tools"] = [
        #         {
        #             "function_declarations": [
        #                 {
        #                     "name": tool.function.name,
        #                     "description": tool.function.description,
        #                     "parameters": tool.function.parameters,
        #                 }
        #                 for tool in tools
        #             ]
        #         }
        #     ]
        else:
            # Default OpenAI format (works for OpenAI and OpenRouter)
            payload["tools"] = [tool.model_dump() for tool in tools]
            if tool_choice != "auto":
                payload["tool_choice"] = tool_choice

    try:
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {model_provider.api_key}",
            "Accept-Encoding": "identity",
        }

        req = requests.post(
            url=f"{model_provider.base_url}/chat/completions",
            headers=headers,
            json=payload,
            stream=stream,
        )
        req.raise_for_status()

        if stream:
            return StreamingResponse(
                req.iter_content(chunk_size=1024),
                media_type="text/event-stream",
            )

        # Convert provider-specific response to OpenAI format if needed
        response_data = req.json()
        if model_provider.provider_name == "anthropic":
            # Convert Anthropic response to OpenAI format
            if "tool_calls" in response_data.get("content", []):
                response_data["choices"][0]["message"]["function_call"] = {
                    "name": response_data["content"][0]["tool_calls"][0]["function"][
                        "name"
                    ],
                    "arguments": response_data["content"][0]["tool_calls"][0][
                        "function"
                    ]["arguments"],
                }
        # elif model_provider.provider_name == "google":
        #     # Convert Google response to OpenAI format
        #     if "functionCall" in response_data.get("candidates", [{}])[0]:
        #         response_data["choices"] = [
        #             {
        #                 "message": {
        #                     "function_call": {
        #                         "name": response_data["candidates"][0]["functionCall"][
        #                             "name"
        #                         ],
        #                         "arguments": response_data["candidates"][0][
        #                             "functionCall"
        #                         ]["args"],
        #                     }
        #                 }
        #             }
        #         ]

        return Response(
            content=json.dumps(response_data),
            status_code=req.status_code,
            headers=dict(req.headers),
        )

    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Error calling LLM API: {str(e)}")


@app.get("/health")
async def health() -> Dict[str, str]:
    return {"status": "ok", "version": os.getenv("VERSION", "0.0.0")}


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
        messages=[Message(**msg) for msg in messages],
        stream=req.stream,
        tools=req.tools,
        tool_choice=req.tool_choice,
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

    if any(msg.role == "system" for msg in req.messages):
        raise HTTPException(status_code=400, detail="System message is not allowed")

    system_message = Message(
        role="system",
        content="""You are a verification assistant. Your task is to verify if the user message is correct or not.
                Use the provided verify_statement function to respond.
                Be concise with your reasoning.
                Always use the function to respond.""",
    )

    model_provider, model = get_model_provider(req.model, req.model_provider)
    messages = [{"role": msg.role, "content": msg.content} for msg in req.messages]
    messages.insert(0, {"role": system_message.role, "content": system_message.content})

    res = get_llm_completion(
        model=model,
        model_provider=model_provider,
        messages=[Message(**msg) for msg in messages],
        stream=False,
        tools=[
            Tool(
                type="function",
                function=Function(
                    name="verify_statement",
                    description="Verify if the user message is correct or not",
                    parameters={
                        "type": "object",
                        "properties": {
                            "is_correct": {
                                "type": "boolean",
                                "description": "Whether the statement is correct (true) or incorrect (false)",
                            },
                            "reason": {
                                "type": "string",
                                "description": "Brief explanation for the verification result",
                            },
                        },
                        "required": ["is_correct", "reason"],
                    },
                ),
            )
        ],
        tool_choice="auto",
    )

    if isinstance(res, StreamingResponse):
        return {
            "result": "no",
            "content": "Streaming response not supported for verification",
        }

    data = json.loads(res.body)
    tool_call = data["choices"][0]["message"].get("tool_calls", [])[0]

    if tool_call:
        args = json.loads(tool_call["function"]["arguments"])
        return {
            "result": "yes" if args["is_correct"] else "no",
            "content": args["reason"],
        }

    # Fallback to content-based response if no tool call
    content = data["choices"][0]["message"]["content"]
    return {
        "result": "yes" if content.strip().lower() == "yes" else "no",
        "content": content,
    }


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
