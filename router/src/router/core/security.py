from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi import HTTPException, Depends
from sqlmodel import select
from supabase import create_client, Client
from src.router.core.types import User
from src.router.models.user import UserCustomClaim
from src.router.models.tokens import ApiToken
from src.router.db.session import get_session
from src.router.core.config import SUPABASE_URL, SUPABASE_KEY
import jwt

DEFAULT_JWT_API_KEY_ID = -1  # Using -1 to indicate JWT authentication

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

        if user_custom_claims is None:
            user_roles = []
        else:
            user_roles = user_custom_claims.claim.get("roles", [])

        return User(
            **user_response.user.model_dump(), roles=user_roles, api_key_id=api_token.id
        )

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

    try:
        userRes = supabase.auth.get_user(token)
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))

    if userRes is None:
        raise HTTPException(
            status_code=401, detail="Unauthorized access - user not found"
        )

    user_roles = decodedToken.get("user_roles", [])
    return User(
        **userRes.user.model_dump(), roles=user_roles, api_key_id=DEFAULT_JWT_API_KEY_ID
    )


def verify_user(user: User = Depends(verify_token)):
    if "user" not in user.roles:
        raise HTTPException(status_code=401, detail="Unauthorized user access")
    return user


def verify_admin(user: User = Depends(verify_token)):
    if "admin" not in user.roles:
        raise HTTPException(status_code=401, detail="Unauthorized admin access")
    return user
