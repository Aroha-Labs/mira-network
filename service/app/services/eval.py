import csv
import io
from typing import List, Dict
from fastapi import HTTPException

from ..models.eval import EvaluationRequest
from .llm import get_llm_completion, get_model_provider
from ..models.chat import Message


def evaluate_model(data: Dict) -> str:
    """
    Evaluate a single prompt against a model
    """
    try:
        system_prompt = data.get("eval_system_prompt", "")
        messages = [
            Message(role="system", content=system_prompt),
            Message(role="user", content=str(data.get("row", []))),
        ]
        
        model_provider, model = get_model_provider(data["model"], None)
        response = get_llm_completion(model, model_provider, messages)
        
        if isinstance(response, str):
            return response
        
        response_data = response.json()
        return response_data["choices"][0]["message"]["content"]
    except Exception as e:
        return f"Error: {str(e)}"


def process_evaluation(req: EvaluationRequest) -> str:
    """
    Process evaluation request and return CSV results
    """
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