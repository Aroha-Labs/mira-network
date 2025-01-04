from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi import HTTPException, Depends
from sqlmodel import select
from supabase import create_client, Client
from src.mira_client_dashboard.models.tokens import ApiToken
from src.mira_client_dashboard.db.session import get_session
from src.mira_client_dashboard.core.config import SUPABASE_URL, SUPABASE_KEY

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

security = HTTPBearer()


def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    isJwtToken = len(token.split(".")) == 3

    if isJwtToken:
        response = supabase.auth.get_user(token)
        if response.user is not None:
            return response.user
        else:
            raise HTTPException(status_code=401, detail="Unauthorized access")

    session = next(get_session())
    api_token = session.exec(
        select(ApiToken).where(ApiToken.token == token, ApiToken.deleted_at.is_(None))
    ).first()

    if api_token is None:
        raise HTTPException(status_code=401, detail="Unauthorized access")

    user_response = supabase.auth.admin.get_user_by_id(api_token.user_id)
    if user_response.user is None:
        raise HTTPException(status_code=401, detail="Unauthorized access")

    return user_response.user
