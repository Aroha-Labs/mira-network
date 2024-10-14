from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import PlainTextResponse
import csv
import uvicorn
import io
from typing import List, Dict
import openai

app = FastAPI()


@app.get("/health")
async def health() -> Dict[str, str]:
    return {"status": "healthy"}


# Mock function to simulate model evaluation
def evaluate_model(prompt: str, expected_response: str, model: str) -> str:
    model_name = model.split("/")[-1]

    ollama_client = openai.Client(
        api_key="sk-1234567890",
        base_url="http://host.docker.internal:11434/v1",
    )

    # openai_client = openai.Client(api_key="sk-1234567890",)

    # client = ollama_client
    # if model_provider == "ollama":
    #     client = ollama_client
    # elif model_provider == "openai":
    #     client = openai_client
    # else:
    #     raise HTTPException(status_code=400, detail="Model provider not supported")

    response = ollama_client.chat.completions.create(
        model=model_name,
        messages=[
            {
                "role": "system",
                "content": "Given a prompt and expected response, evaluate the response. Only 'true' or 'false' are valid responses. Do not provide any other information.",
            },
            {
                "role": "user",
                "content": """Prompt: "{}"\nExpected Response: "{}" """.format(
                    prompt,
                    expected_response,
                ),
            },
        ],
    )

    return response.choices[0].message.content.strip().lower().replace(".", "")


@app.post("/v1/eval", response_class=PlainTextResponse)
async def evaluate(request: Request) -> str:
    data: Dict[str, List[str]] = await request.json()
    csv_string: str = data.get("csv", "")
    models = data.get("models", [])

    if not csv_string or not models:
        raise HTTPException(status_code=400, detail="Invalid input")

    # Parse the CSV string
    csv_reader = csv.reader(io.StringIO(csv_string))
    headers: List[str] = next(csv_reader)
    prompts: List[List[str]] = list(csv_reader)

    # Prepare the result CSV
    output = io.StringIO()
    csv_writer = csv.writer(output)
    result_headers: List[str] = ["Prompt", "Expected Response"] + models
    csv_writer.writerow(result_headers)

    # Evaluate each prompt against each model
    for prompt, expected_response in prompts:
        row: List[str] = [prompt, expected_response]
        for model in models:
            result: str = evaluate_model(prompt, expected_response, model)
            row.append(result)
        csv_writer.writerow(row)

    return output.getvalue()


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
