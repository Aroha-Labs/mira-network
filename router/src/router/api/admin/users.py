from typing import Any, List, Dict, Optional
import uuid
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func
from sqlmodel import Session, select
from src.router.schemas.credits import AddCreditRequest
from src.router.core.security import supabase, verify_admin
from src.router.models.user import UserCreditsHistory
from src.router.db.session import get_session
from enum import Enum
from gotrue.types import User
from datetime import datetime, timezone
from src.router.models.user import User as UserModel  # rename to avoid conflict

router = APIRouter()


# SUPABASE_SECRET = os.getenv("SUPABASE_HOOK_SECRET")
#
# def verify_supabase_request(payload: bytes, signature: str) -> bool:
#     """
#     Verify the webhook request by comparing the computed HMAC signature with the received one.
#     :param secret: The secret shared with Supabase
#     :param payload: The raw request body
#     :param signature: The signature from Supabase (x-supabase-signature)
#     :return: True if valid, False otherwise
#     """
#     # Compute HMAC SHA256 signature
#     computed_signature = hmac.new(
#         SUPABASE_SECRET.encode(),
#         payload,
#         hashlib.sha256,
#     ).hexdigest()
#
#     # Compare signatures
#     return hmac.compare_digest(computed_signature, signature)


class SortField(str, Enum):
    CREATED_AT = "created_at"
    LAST_LOGIN = "last_login_at"
    CREDITS = "credits"
    EMAIL = "email"
    FULL_NAME = "full_name"

class SortOrder(str, Enum):
    ASC = "asc"
    DESC = "desc"

@router.get(
    "/users",
    summary="List Users",
    description="Retrieve a paginated list of users with optional search, sort, and filters.",
)
def list_users(
    page: int = 1,
    per_page: int = 10,
    search: str = "",
    sort_by: Optional[SortField] = None,
    sort_order: SortOrder = SortOrder.DESC,
    min_credits: Optional[float] = None,
    max_credits: Optional[float] = None,
    provider: Optional[str] = None,
    user: User = Depends(verify_admin),
    db: Session = Depends(get_session),
):
    def apply_filters(query):
        if search:
            search_pattern = f"%{search}%"
            query = query.where(
                (UserModel.full_name.ilike(search_pattern)) | (UserModel.email.ilike(search_pattern))
            )
        if min_credits is not None:
            query = query.where(UserModel.credits >= min_credits)
        if max_credits is not None:
            query = query.where(UserModel.credits <= max_credits)
        if provider:
            query = query.where(UserModel.provider == provider)
        return query

    offset = (page - 1) * per_page
    
    # Main query for users
    query = apply_filters(select(UserModel))

    # Apply sorting
    if sort_by:
        sort_column = getattr(UserModel, sort_by.value)
        if sort_order == SortOrder.DESC:
            sort_column = sort_column.desc()
        query = query.order_by(sort_column)
    else:
        query = query.order_by(UserModel.created_at.desc())

    # Count query
    count_query = apply_filters(select(func.count()).select_from(UserModel))
    total_users = db.exec(count_query).first()

    users = db.exec(query.offset(offset).limit(per_page))

    return {
        "users": users.all(),
        "total": total_users,
        "page": page,
        "per_page": per_page,
    }


# class UserMetadata(BaseModel):
#     avatar_url: str
#     custom_claims: Dict[str, str]
#     email: str
#     email_verified: bool
#     full_name: str
#     iss: str
#     name: str
#     phone_verified: bool
#     picture: str
#     provider_id: str
#     sub: str


# class AppMetadata(BaseModel):
#     provider: str
#     providers: List[str]


# class Claims(BaseModel):
#     iss: str
#     sub: str
#     aud: str
#     exp: int
#     iat: int
#     email: str
#     phone: str
#     app_metadata: AppMetadata
#     user_metadata: UserMetadata
#     role: str
#     aal: str
#     amr: List[Dict[str, str]]
#     session_id: str
#     is_anonymous: bool


class UserClaimWebhook(BaseModel):
    user_id: str
    claims: dict


def process_user_claims(claims: dict) -> dict:
    metadata = claims.get("user_metadata", {})
    app_metadata = claims.get("app_metadata", {})

    return {
        "email": metadata.get("email"),
        "full_name": metadata.get("full_name"),
        "avatar_url": metadata.get("avatar_url"),
        "provider": app_metadata.get("provider", ""),
        "meta": {"user_metadata": metadata, "app_metadata": app_metadata},
        "custom_claim": {
            "roles": [],
        },  # Initialize with empty dict
        "credits": 0,  # Initialize with default value
        # "last_login_at": datetime.now(timezone.utc),
    }


@router.post(
    "/user-claims",
    summary="Supabase User Claim Webhook",
    description="Return the updated claims for a user.",
)
async def add_or_update_user_claim(
    req: UserClaimWebhook,
    db: Session = Depends(get_session),
):
    # Process user information
    user_data = process_user_claims(req.claims)
    user = db.exec(select(UserModel).where(UserModel.user_id == req.user_id)).first()

    if user:
        user.email = user_data["email"]
        user.full_name = user_data["full_name"]
        user.avatar_url = user_data["avatar_url"]
        user.provider = user_data["provider"]
        user.meta = user_data["meta"]
        user.updated_at = datetime.now(timezone.utc)
        user.last_login_at = datetime.now(timezone.utc)
    else:
        # Create new user with all required fields
        user = UserModel(
            id=uuid.uuid4(),
            user_id=req.user_id,
            full_name=user_data.get("full_name", ""),
            email=user_data.get("email", ""),
            avatar_url=user_data.get("avatar_url", ""),
            provider=user_data.get("provider", ""),
            meta=user_data.get("meta", {}),
            credits=user_data.get("credits", 0),
            last_login_at=datetime.now(timezone.utc),
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        db.add(user)

    if user.custom_claim:
        req.claims.update({"user_roles": user.custom_claim.get("roles", [])})

    db.commit()

    data = {"user_id": req.user_id, "claims": req.claims}
    return data


class RoleEnum(str, Enum):
    admin = "admin"
    user = "user"


class UserClaim(BaseModel):
    roles: List[RoleEnum]


@router.post(
    "/user-claims/{user_id}",
    summary="Add or Update User Claim",
    description="Add or update a custom claim for a user.",
)
def user_claim_webhook(
    user_id: str,
    claim: UserClaim,
    db: Session = Depends(get_session),
    user=Depends(verify_admin),
) -> Dict[str, Any]:
    user = db.exec(select(UserModel).where(UserModel.user_id == user_id)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.custom_claim = claim.model_dump()
    db.commit()
    db.refresh(user)
    return {"user_id": user.user_id, "custom_claim": user.custom_claim}


@router.get(
    "/user-claims/{user_id}",
    summary="Get User Claim",
    description="Retrieve the custom claim for a user.",
)
def get_user_claim(
    user_id: str,
    db: Session = Depends(get_session),
    user=Depends(verify_admin),
) -> dict:
    user = db.exec(select(UserModel).where(UserModel.user_id == user_id)).first()
    if not user:
        return {}
    return {
        "custom_claim": user.custom_claim,
        "created_at": user.created_at,
        "user_id": user.user_id,
        "id": user.id,
    }


@router.get(
    "/user-credits/{user_id}",
    summary="Get User Credits",
    description="Retrieve the credits for a user.",
)
def get_user_credits_by_id(
    user_id: str,
    db: Session = Depends(get_session),
    user=Depends(verify_admin),
):
    user_data = db.exec(select(UserModel).where(UserModel.user_id == user_id)).first()
    if not user_data:
        return {"credits": 0}
    return {"credits": user_data.credits}


@router.post("/add-credit")
def add_credit(
    request: AddCreditRequest,
    db: Session = Depends(get_session),
    user=Depends(verify_admin),
):
    user_data = db.exec(
        select(UserModel).where(UserModel.user_id == request.user_id)
    ).first()

    if not user_data:
        raise HTTPException(status_code=404, detail="User not found")

    user_data.credits += request.amount
    user_data.updated_at = datetime.utcnow()

    credit_history = UserCreditsHistory(
        user_id=request.user_id,
        amount=request.amount,
        description=request.description,
    )
    db.add(credit_history)
    db.commit()

    return {"credits": user_data.credits}


@router.post(
    "/update-users",
    summary="Update Users from Supabase",
    description="Pull user details from Supabase and update the users table.",
)
def update_users_from_supabase(
    user: User = Depends(verify_admin),
    db: Session = Depends(get_session),
):
    # get all users from supabase and update the users table
    users = []
    page = 1
    while True:
        page_users = supabase.auth.admin.list_users(page=page, per_page=100)
        users.extend(page_users)
        if len(page_users) < 100:
            break
        page += 1

    # users = supabase.auth.admin.list_users(page=1, per_page=100)

    for supabase_user in users:
        user_data = {
            "email": supabase_user.email,
            "full_name": supabase_user.user_metadata.get("full_name"),
            "avatar_url": supabase_user.user_metadata.get("avatar_url"),
            "provider": supabase_user.app_metadata.get("provider", ""),
            "meta": {
                "user_metadata": supabase_user.user_metadata,
                "app_metadata": supabase_user.app_metadata,
            },
            "last_login_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        }

        user = db.exec(
            select(UserModel).where(UserModel.user_id == supabase_user.id)
        ).first()

        if user:
            for key, value in user_data.items():
                setattr(user, key, value)
        else:
            user = UserModel(user_id=supabase_user.id, **user_data)
            db.add(user)

    db.commit()
    return {"status": "success"}
