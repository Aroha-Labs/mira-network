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


@router.post(
    "/api-tokens",
    summary="Create API Token",
    description="""
    Creates a new API token for the authenticated user.
    Generates a secure random token with 'sk-mira-' prefix.
    Stores token details including description and creation timestamp.
    """,
    response_description="Returns the created API token details",
    responses={
        200: {"description": "Successfully created API token"},
        401: {"description": "Unauthorized - Invalid or missing authentication"},
        500: {"description": "Internal server error while creating token"},
    },
)
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
        "id": api_token.id,
        "token": api_token.token,
        "description": api_token.description,
        "created_at": api_token.created_at,
    }


@router.get(
    "/api-tokens",
    summary="List API Tokens",
    description="Retrieves all active API tokens for the authenticated user.",
    response_description="Returns an array of API token details",
    responses={
        200: {"description": "Successfully retrieved API tokens"},
        401: {"description": "Unauthorized - Invalid or missing authentication"},
    },
)
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
            "id": token.id,
            "token": token.token,
            "description": token.description,
            "created_at": token.created_at,
        }
        for token in tokens
    ]


@router.delete(
    "/api-tokens/{token}",
    summary="Delete API Token",
    description="""
    Soft deletes an API token by setting its deleted_at timestamp.
    Only allows deletion of tokens owned by the authenticated user.
    """,
    response_description="Returns success message",
    responses={
        200: {"description": "Successfully deleted API token"},
        401: {"description": "Unauthorized - Invalid or missing authentication"},
        404: {"description": "Token not found"},
    },
)
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
