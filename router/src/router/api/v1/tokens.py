from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from src.router.core.types import User
from src.router.models.tokens import ApiToken
from src.router.schemas.tokens import ApiTokenRequest
from src.router.db.session import get_session
from src.router.core.security import verify_user
from datetime import datetime
import os

router = APIRouter()


@router.post("/api-tokens")
def create_api_token(
    request: ApiTokenRequest,
    db: Session = Depends(get_session),
    user: User = Depends(verify_user),
):
    token = f"sk-mira-{os.urandom(24).hex()}"
    try:
        api_token = ApiToken(
            user_id=user.id,
            token=token,
            description=request.description,
        )
        db.add(api_token)
        db.commit()
        db.refresh(api_token)
    except Exception as e:
        db.rollback()
        print(e)
        raise HTTPException(status_code=500, detail=str(e))
    return {
        "token": api_token.token,
        "description": api_token.description,
        "created_at": api_token.created_at,
    }


@router.get("/api-tokens")
def list_api_tokens(
    db: Session = Depends(get_session), user: User = Depends(verify_user)
):
    tokens = (
        db.query(ApiToken)
        .filter(ApiToken.user_id == user.id, ApiToken.deleted_at.is_(None))
        .all()
    )
    return [
        {
            "token": token.token,
            "description": token.description,
            "created_at": token.created_at,
        }
        for token in tokens
    ]


@router.delete("/api-tokens/{token}")
def delete_api_token(
    token: str, db: Session = Depends(get_session), user: User = Depends(verify_user)
):
    api_token = (
        db.query(ApiToken)
        .filter(ApiToken.token == token, ApiToken.user_id == user.id)
        .first()
    )
    if not api_token:
        raise HTTPException(status_code=404, detail="Token not found")

    api_token.deleted_at = datetime.utcnow()
    db.commit()
    db.refresh(api_token)
    return {"message": "Token deleted successfully"}
