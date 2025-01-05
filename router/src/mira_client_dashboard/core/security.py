from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi import HTTPException, Depends
from sqlmodel import select
from supabase import create_client, Client
from src.mira_client_dashboard.models.user import UserCustomClaim
from src.mira_client_dashboard.models.tokens import ApiToken
from src.mira_client_dashboard.db.session import get_session
from src.mira_client_dashboard.core.config import SUPABASE_URL, SUPABASE_KEY
import jwt
from gotrue.types import User

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

security = HTTPBearer()


def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials

    # check if token starts with `sk-mira-` (API token)
    if token.startswith("sk-mira-"):
        db = next(get_session())
        api_token = db.exec(
            select(ApiToken).where(
                ApiToken.token == token, ApiToken.deleted_at.is_(None)
            )
        ).first()

        if api_token is None:
            raise HTTPException(status_code=401, detail="Unauthorized access")

        user_response = supabase.auth.admin.get_user_by_id(api_token.user_id)
        if user_response.user is None:
            raise HTTPException(status_code=401, detail="Unauthorized access")

        user_custom_claims = db.exec(
            select(UserCustomClaim).where(
                UserCustomClaim.user_id == user_response.user.id
            )
        ).first()

        custom_claims = user_response.user.user_metadata.get("custom_claims", {})
        custom_claims.update(user_custom_claims.claim)
        user_response.user.user_metadata.update({"custom_claims": custom_claims})

        return user_response.user

    # Verify if token is a JWT token (supabase token)
    decodedToken: dict = None
    try:
        decodedToken = jwt.decode(token, options={"verify_signature": False})
    except jwt.exceptions.DecodeError:
        raise HTTPException(status_code=401, detail="Unauthorized access")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    except jwt.InvalidIssuerError:
        raise HTTPException(status_code=401, detail="Invalid issuer")
    except jwt.InvalidAudienceError:
        raise HTTPException(status_code=401, detail="Invalid audience")
    except jwt.InvalidAlgorithmError:
        raise HTTPException(status_code=401, detail="Invalid algorithm")
    except jwt.InvalidIssuedAtError:
        raise HTTPException(status_code=401, detail="Invalid issued at")
    except jwt.InvalidKeyError:
        raise HTTPException(status_code=401, detail="Invalid key")
    except jwt.InvalidSignatureError:
        raise HTTPException(status_code=401, detail="Invalid signature")
    except jwt.MissingRequiredClaimError:
        raise HTTPException(status_code=401, detail="Missing required claim")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="PyJWTError")
    except:
        raise HTTPException(status_code=401, detail="Unknown error")

    userRes = supabase.auth.get_user(token)
    if userRes.user is not None:
        token_custom_claims = decodedToken.get("user_metadata", {}).get(
            "custom_claims", {}
        )
        userRes.user.user_metadata.get("custom_claims").update(token_custom_claims)
        return userRes.user
    else:
        raise HTTPException(status_code=401, detail="Unauthorized access")


def verify_user(user: User = Depends(verify_token)):
    if "user" not in user.user_metadata.get("custom_claims", {}).get("roles", []):
        raise HTTPException(status_code=401, detail="Unauthorized access")
    return user


def verify_admin(user: User = Depends(verify_token)):
    if "admin" not in user.user_metadata.get("custom_claims", {}).get("roles", []):
        raise HTTPException(status_code=401, detail="Unauthorized access")
    return user
