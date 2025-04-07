from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi import HTTPException, Depends
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from supabase._async.client import AsyncClient, create_client
from supabase import AsyncClientOptions
from typing import Annotated
from src.router.core.types import User
from src.router.models.user import User as UserModel
from src.router.models.tokens import ApiToken
from src.router.db.session import DBSession
from src.router.core.config import SUPABASE_URL, SUPABASE_KEY
import jwt
from src.router.models.machine_tokens import MachineToken
from src.router.models.machines import Machine
import logging
from src.router.utils.redis import redis_client
import json

logger = logging.getLogger(__name__)


DEFAULT_JWT_API_KEY_ID = -1  # Using -1 to indicate JWT authentication

security = HTTPBearer()

CACHE_TTL = 3600  # 1 hour
JWT_CACHE_TTL = 300  # 5 minutes for JWT tokens

_supabase_client = None


async def get_supabase_client() -> AsyncClient:
    """Initialize async Supabase client with proper timeouts"""
    global _supabase_client

    if _supabase_client is not None:
        return _supabase_client

    try:
        client = await create_client(
            SUPABASE_URL,
            SUPABASE_KEY,
            options=AsyncClientOptions(
                postgrest_client_timeout=10, storage_client_timeout=10
            ),
        )
        if not client:
            raise ValueError("Client initialization failed")

        _supabase_client = client
        return client
    except Exception as e:
        logger.error(f"Failed to initialize Supabase client: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to initialize auth client")


SupabaseClient = Annotated[AsyncClient, Depends(get_supabase_client)]


async def verify_token(
    supabase: SupabaseClient,
    db: DBSession,
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    token = credentials.credentials
    cache_key = f"token:{token}"

    # Try Redis first
    cached_data = await redis_client.get(cache_key)
    if cached_data:
        try:
            data = json.loads(cached_data)
            return User(**data) if not data.get("type") == "machine" else data
        except Exception as e:
            logger.warning(f"Cache parse error for token {token[:10]}...: {str(e)}")

    if token.startswith("sk-mira-"):
        result = await handle_api_token(token, db, supabase)
        await cache_token_data(cache_key, result.model_dump_json(), CACHE_TTL)
        return result

    if token.startswith("mk-mira-"):
        result = await handle_machine_token(token, db)
        await cache_token_data(cache_key, json.dumps(result), CACHE_TTL)
        return result

    # Handle JWT token
    result = await handle_jwt_token(token, supabase)
    await cache_token_data(cache_key, result.model_dump_json(), JWT_CACHE_TTL)
    return result


async def handle_api_token(token: str, db: AsyncSession, supabase: SupabaseClient):
    api_token = await db.exec(
        select(ApiToken).where(
            ApiToken.token == token,
            ApiToken.deleted_at == None,  # noqa
        )
    )
    api_token = api_token.first()

    if not api_token:
        raise HTTPException(
            status_code=401, detail="Unauthorized access - API token not found"
        )

    try:
        user_response = await supabase.auth.admin.get_user_by_id(api_token.user_id)
        if not user_response.user:
            raise HTTPException(
                status_code=401, detail="Unauthorized access - user not found"
            )
    except Exception as e:
        logger.error(e, exc_info=e)
        raise HTTPException(status_code=500, detail="supabase connection failed")

    user = await db.exec(
        select(UserModel).where(UserModel.user_id == user_response.user.id)
    )
    user = user.first()
    user_roles = user.custom_claim.get("roles", []) if user else []

    return User(
        **user_response.user.model_dump(),
        roles=user_roles,
        api_key_id=api_token.id,
    )


async def handle_machine_token(token: str, db: AsyncSession):
    machines = await db.exec(
        select(MachineToken, Machine)
        .join(Machine, MachineToken.machine_id == Machine.id)
        .where(
            MachineToken.api_token == token,
            MachineToken.deleted_at == None,  # noqa
            Machine.disabled == False,  # noqa
        )
    )
    machines = machines.all()

    if not machines:
        raise HTTPException(status_code=401, detail="Invalid machine token")

    return {
        "type": "machine",
        "token_id": str(machines[0][0].id),
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


async def handle_jwt_token(token: str, supabase: SupabaseClient):
    try:
        decoded_token = jwt.decode(token, options={"verify_signature": False})
        user_res = await supabase.auth.get_user(token)

        if not user_res:
            raise HTTPException(
                status_code=401, detail="Unauthorized access - user not found"
            )

        return User(
            **user_res.user.model_dump(),
            roles=decoded_token.get("user_roles", []),
            api_key_id=DEFAULT_JWT_API_KEY_ID,
        )
    except Exception as e:
        logger.error(f"JWT validation error: {e}")
        raise HTTPException(status_code=401, detail="Invalid token")


async def cache_token_data(key: str, data: str, ttl: int):
    await redis_client.set(
        key,
        data,
        ex=ttl,
    )


async def verify_user(user: User = Depends(verify_token)):
    if "user" not in user.roles:
        raise HTTPException(status_code=401, detail="Unauthorized user access")
    return user


async def verify_admin(user: User = Depends(verify_token)):
    if "admin" not in user.roles:
        raise HTTPException(status_code=401, detail="Unauthorized admin access")
    return user


async def verify_machine(token_data: dict = Depends(verify_token)):
    if token_data.get("type") != "machine":
        raise HTTPException(status_code=401, detail="Invalid machine token")
    return token_data
