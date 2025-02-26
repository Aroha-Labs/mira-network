from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from ...models.chat import AiRequest, Message, VerifyRequest
from ...services.llm import get_model_provider, get_llm_completion
import json

router = APIRouter()


@router.post("/chat/completions")
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


@router.post("/verify")
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