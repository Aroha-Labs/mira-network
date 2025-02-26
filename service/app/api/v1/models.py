import os
import json
from fastapi import APIRouter

router = APIRouter()


@router.get("/models")
async def list_models():
    file_path = os.path.join(
        os.path.dirname(__file__), "../../../../router/supported-models.json"
    )

    with open(file_path, "r") as f:
        supported_models: list[str] = json.load(f)

    return {
        "object": "list",
        "data": [{"id": model, "object": "model"} for model in supported_models],
    } 