from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi import HTTPException, Depends
from sqlmodel import select
from supabase import create_client, Client, create_async_client
from src.router.core.types import User
from src.router.models.user import User as UserModel
from src.router.models.tokens import ApiToken
from src.router.db.session import get_session, get_session_context
from sqlmodel.ext.asyncio.session import AsyncSession
from src.router.db.base import async_engine
from src.router.core.config import SUPABASE_URL, SUPABASE_KEY
import jwt
from src.router.models.machine_tokens import MachineToken
from src.router.models.machines import Machine
import logging

logger = logging.getLogger(__name__)


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
                ApiToken.token == token,
                ApiToken.deleted_at == None,  # noqa
            )
        ).first()

        if api_token is None:
            raise HTTPException(
                status_code=401, detail="Unauthorized access - API token not found"
            )

        user_response = supabase.auth.admin.get_user_by_id(api_token.user_id)

        if user_response.user is None:
            raise HTTPException(
                status_code=401, detail="Unauthorized access - user not found"
            )

        user = db.exec(
            select(UserModel).where(UserModel.user_id == user_response.user.id)
        ).first()

        if user is None:
            user_roles = []
        else:
            user_roles = user.custom_claim.get("roles", [])

        return User(
            **user_response.user.model_dump(),
            roles=user_roles,
            api_key_id=api_token.id,
        )

    # check if token starts with `mk-mira-` (machine token)
    if token.startswith("mk-mira-"):
        db = next(get_session())
        machines = db.exec(
            select(MachineToken, Machine)
            .join(Machine, MachineToken.machine_id == Machine.id)
            .where(
                MachineToken.api_token == token,
                MachineToken.deleted_at == None,
                Machine.disabled == False,
            )
        ).all()

        if not machines:
            raise HTTPException(status_code=401, detail="Invalid machine token")

        return {
            "type": "machine",
            "token_id": machines[0][0].id,
            "machines": [
                {
                    "id": machine[1].id,
                    "network_ip": machine[1].network_ip,
                    "name": machine[1].name,
                    "disabled": machine[1].disabled,
                }
                for machine in machines
            ],
        }

    # Verify if token is a JWT token (supabase token)
    decodedToken: dict = None
    try:
        decodedToken = jwt.decode(token, options={"verify_signature": False})
    except jwt.exceptions.DecodeError:
        raise HTTPException(
            status_code=401, detail="Unauthorized access - invalid token"
        )
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


async def async_verify_token(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    token = credentials.credentials

    # check if token starts with `sk-mira-` (API token)
    if token.startswith("sk-mira-"):
        async with get_session_context() as db:
            try:
                api_token = await db.exec(
                    select(ApiToken).where(
                        ApiToken.token == token,
                        ApiToken.deleted_at == None,  # noqa
                    )
                )
                api_token = api_token.first()

                if api_token is None:
                    raise HTTPException(
                        status_code=401,
                        detail="Unauthorized access - API token not found",
                    )

                async_supabase = await create_async_client(SUPABASE_URL, SUPABASE_KEY)
                user_response = await async_supabase.auth.admin.get_user_by_id(
                    api_token.user_id
                )

                if user_response.user is None:
                    raise HTTPException(
                        status_code=401, detail="Unauthorized access - user not found"
                    )

                user = await db.exec(
                    select(UserModel).where(UserModel.user_id == user_response.user.id)
                )
                user = user.first()

                if user is None:
                    user_roles = []
                else:
                    user_roles = user.custom_claim.get("roles", [])

                return User(
                    **user_response.user.model_dump(),
                    roles=user_roles,
                    api_key_id=api_token.id,
                )
            except Exception as e:
                logger.error(f"Error verifying token in async_verify_token: {e}")
                raise HTTPException(status_code=401, detail=str(e))

    # Verify if token is a JWT token (supabase token)
    decodedToken: dict = None
    try:
        decodedToken = jwt.decode(token, options={"verify_signature": False})
    except jwt.exceptions.DecodeError:
        raise HTTPException(
            status_code=401, detail="Unauthorized access - invalid token"
        )
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
        async_supabase = await create_async_client(SUPABASE_URL, SUPABASE_KEY)
        userRes = await async_supabase.auth.get_user(token)

        if userRes is None:
            raise HTTPException(
                status_code=401, detail="Unauthorized access - user not found"
            )

        user_roles = decodedToken.get("user_roles", [])
        return User(
            **userRes.user.model_dump(),
            roles=user_roles,
            api_key_id=DEFAULT_JWT_API_KEY_ID,
        )
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))

    raise HTTPException(status_code=401, detail="Invalid token")


def verify_user(user: User = Depends(verify_token)):
    if "user" not in user.roles:
        raise HTTPException(status_code=401, detail="Unauthorized user access")
    return user


async def async_verify_user(user: User = Depends(async_verify_token)):
    if "user" not in user.roles:
        raise HTTPException(status_code=401, detail="Unauthorized user access")
    return user


def verify_admin(user: User = Depends(verify_token)):
    if "admin" not in user.roles:
        raise HTTPException(status_code=401, detail="Unauthorized admin access")
    return user


def verify_machine(token_data: dict = Depends(verify_token)):
    if token_data.get("type") != "machine":
        raise HTTPException(status_code=401, detail="Invalid machine token")
    return token_data
