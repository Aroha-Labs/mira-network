from fastapi import FastAPI, HTTPException, Response
from fastapi.responses import PlainTextResponse, StreamingResponse
import csv
import io
from typing import List, Dict, Optional
from pydantic import BaseModel, Field
from eval import evaluate_model
import os
import asyncio
import httpx
import logging
import json
import requests
from config import Env
from machine_registry import register_machine, get_local_ip
import sys

app = FastAPI()

ROUTER_BASE_URL = os.getenv("ROUTER_BASE_URL")

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
    "groq": ModelProvider(
        base_url=os.getenv("GROQ_BASE_URL", "https://api.groq.com/openai/v1"),
        api_key=os.getenv("GROQ_API_KEY"),
        provider_name="groq",
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


async def get_model_provider_async(
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


async def get_llm_completion_async(
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

    if model_provider.provider_name == "openrouter":
        payload["provider"] = {
            "ignore": [
                "Azure",
                "DeepInfra",
                "Nebius",
                "InferenceNet",
                "Novita",
                "Lambda",
            ],
        }
    # Add tools/functions if provided
    if tools:
        if model_provider.provider_name == "anthropic":
            payload["tools"] = [tool.model_dump() for tool in tools]
        else:
            payload["tools"] = [tool.model_dump() for tool in tools]
            if tool_choice != "auto":
                payload["tool_choice"] = tool_choice

    try:
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {model_provider.api_key}",
            "Accept-Encoding": "identity",
        }

        async with httpx.AsyncClient(
            timeout=httpx.Timeout(connect=60.0, read=180.0, write=60.0, pool=240.0),
            transport=httpx.AsyncHTTPTransport(retries=5),
        ) as client:
            try:
                req = await client.post(
                    url=f"{model_provider.base_url}/chat/completions",
                    headers=headers,
                    json=payload,
                )
                req.raise_for_status()
                
                if stream:
                    return StreamingResponse(
                        req.aiter_bytes(chunk_size=1024),
                        media_type="text/event-stream",
                    )

                # Convert provider-specific response to OpenAI format if needed
                response_data = req.json()
                if model_provider.provider_name == "anthropic":
                    # Convert Anthropic response to OpenAI format
                    if "tool_calls" in response_data.get("content", []):
                        response_data["choices"][0]["message"]["function_call"] = {
                            "name": response_data["content"][0]["tool_calls"][0][
                                "function"
                            ]["name"],
                            "arguments": response_data["content"][0]["tool_calls"][0][
                                "function"
                            ]["arguments"],
                        }

                return Response(
                    content=json.dumps(response_data),
                    status_code=req.status_code,
                    headers=dict(req.headers),
                )
                
            except httpx.TimeoutException as e:
                import traceback
                logging.error(f"Timeout error calling {model_provider.provider_name} API: {e}")
                logging.error(f"Timeout details: connect={client.timeout.connect}, read={client.timeout.read}, write={client.timeout.write}, pool={client.timeout.pool}")
                logging.error("Timeout traceback: " + traceback.format_exc())
                raise HTTPException(status_code=504, detail=f"Timeout error calling {model_provider.provider_name} API: {str(e)}")
                
            except httpx.HTTPStatusError as e:
                import traceback
                logging.error(f"HTTP status error from {model_provider.provider_name} API: {e.response.status_code} - {e.response.text}")
                logging.error("HTTP error traceback: " + traceback.format_exc())
                
                # Try to parse the error response
                error_detail = str(e)
                try:
                    error_json = e.response.json()
                    if "error" in error_json:
                        error_detail = f"{error_json.get('error', {}).get('message', str(e))}"
                except:
                    pass
                    
                raise HTTPException(
                    status_code=e.response.status_code, 
                    detail=f"Error from {model_provider.provider_name} API: {error_detail}"
                )
                
            except httpx.RequestError as e:
                import traceback
                logging.error(f"Request error calling {model_provider.provider_name} API: {e}")
                logging.error("Request error traceback: " + traceback.format_exc())
                raise HTTPException(status_code=500, detail=f"Request error calling {model_provider.provider_name} API: {str(e)}")
                
            except json.JSONDecodeError as e:
                import traceback
                logging.error(f"JSON decode error from {model_provider.provider_name} API response: {e}")
                logging.error("JSON error traceback: " + traceback.format_exc())
                raise HTTPException(status_code=500, detail=f"Invalid JSON response from {model_provider.provider_name} API")
                
    except Exception as e:
        import traceback
        logging.error(f"Unexpected error calling {model_provider.provider_name} API: {e}")
        logging.error("Unexpected error traceback: " + traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Unexpected error calling {model_provider.provider_name} API: {str(e)}")


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

    model_provider, model = await get_model_provider_async(
        req.model, req.model_provider
    )

    # Convert Message objects to dictionaries
    messages = [{"role": msg.role, "content": msg.content} for msg in req.messages]

    try:
        response = await get_llm_completion_async(
            model,
            model_provider,
            messages=[Message(**msg) for msg in messages],
            stream=req.stream,
            tools=req.tools,
            tool_choice=req.tool_choice,
        )
    except Exception as e:
        import traceback

        logging.error(f"Error generating response: {e}")
        logging.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error generating response: {e}")

    # Add MACHINE_IP to response headers with None check
    if Env.MACHINE_IP:
        response.headers["x-machine-ip"] = Env.MACHINE_IP
    else:
        # Fallback to local IP if MACHINE_IP is not set
        local_ip = get_local_ip()
        response.headers["x-machine-ip"] = local_ip

    return response


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

    if not any(msg.role == "system" for msg in req.messages):
        system_message = Message(
            role="system",
            content="""You are a verification assistant. Your task is to verify if the user message is correct or not.
                    Use the provided verify_statement function to respond.
                    Be concise with your reasoning.
                    Always use the function to respond.""",
        )
        req.messages.insert(0, system_message)

    model_provider, model = get_model_provider(req.model, req.model_provider)
    messages = [{"role": msg.role, "content": msg.content} for msg in req.messages]

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


async def update_liveness(machine_ip: str):
    url = f"{ROUTER_BASE_URL}/liveness/{machine_ip}"
    headers = {"Authorization": f"Bearer {Env.MACHINE_API_TOKEN}"}

    while True:
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(url, headers=headers)
                response.raise_for_status()
                logging.info(f"Liveness check successful for {machine_ip}")
            except httpx.HTTPStatusError as exc:
                logging.error(
                    f"HTTP error occurred: {exc.response.status_code} - {exc.response.text}"
                )
            except Exception as exc:
                logging.error(f"An error occurred: {exc}")
        await asyncio.sleep(3)


@app.on_event("startup")
async def startup_event():
    # Get the machine IP from environment or determine the local IP
    MACHINE_IP = Env.MACHINE_IP
    if MACHINE_IP is None:
        MACHINE_IP = get_local_ip()
        logging.info(f"Determined local IP: {MACHINE_IP}")

    # Register the machine with the router and get an API token (with retries)
    logging.info("Starting machine registration process...")
    machine_token = await register_machine(ROUTER_BASE_URL)

    if machine_token:
        logging.info("Machine registered successfully and token acquired")
        os.environ["MACHINE_API_TOKEN"] = machine_token
        Env.MACHINE_API_TOKEN = machine_token
        logging.info(f"Using machine name: {Env.MACHINE_NAME}")

        # Start the liveness update task only if registration succeeded
        asyncio.create_task(update_liveness(MACHINE_IP))
    else:
        # Registration failed, exit the application
        logging.critical(
            "Failed to register machine or acquire token after multiple attempts"
        )
        logging.critical("Machine registration is required to run the service")
        logging.critical("Shutting down...")
        # Exit with non-zero status to indicate failure
        sys.exit(1)
