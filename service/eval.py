from typing import List, Tuple
import openai
from pydantic import BaseModel

supported_providers = [
    "ollama",
    "openai",
    "openrouter",
]


def get_client_and_model(model: str) -> Tuple[openai.Client, str]:
    model_provider, model_name = model.split("/", 1)

    base_url = None
    api_key = None
    if model_provider == "ollama":
        base_url = "http://host.docker.internal:11434/v1"
        api_key = "sk-xxxxxxxxxxx"
    elif model_provider == "openai":
        api_key = "sk-1234567890"
    elif model_provider == "openrouter":
        base_url = "https://openrouter.ai/api/v1"
        api_key = "sk-1234567890"
    else:
        raise Exception("Model provider not supported")
    
    client = openai.Client(
        api_key=api_key,
        base_url=base_url,
    )

    return client, model_name


class EvalModelRequest(BaseModel):
    headers: List[str]
    row: List[str]
    model: str
    eval_system_prompt: str

# Mock function to simulate model evaluation
def evaluate_model(req: EvalModelRequest) -> str:
    client, model_name = get_client_and_model(req.model)

    user_prompt = ""
    if len(req.headers) != len(req.row):
        raise Exception("Headers and row do not match")

    for i in range(len(req.headers)):
        header = req.headers[i]
        if header == "":
            user_prompt += """{}\n\n\n""".format(req.row[i])
        else:
            user_prompt += """{}:\n {}\n\n\n""".format(header, req.row[i])

    response = client.chat.completions.create(
        model=model_name,
        messages=[
            {
                "role": "system",
                # "content": "Given a prompt and expected response, evaluate the response. Only 'true' or 'false' are valid responses. Do not provide any other information.",
                "content": req.eval_system_prompt,
            },
            # {
            #     "role": "user",
            #     "content": """Prompt: "{}"\nExpected Response: "{}" """.format(
            #         prompt,
            #         expected_response,
            #     ),
            # },
            {
                "role": "user",
                "content": user_prompt,
            },
        ],
    )

    return response.choices[0].message.content.strip().lower().replace(".", "")
