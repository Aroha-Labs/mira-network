from fastapi import APIRouter
from fastapi.responses import PlainTextResponse

from ...models.eval import EvaluationRequest
from ...services.eval import process_evaluation

router = APIRouter()


@router.post("/eval", response_class=PlainTextResponse)
async def evaluate(req: EvaluationRequest) -> str:
    return process_evaluation(req) 