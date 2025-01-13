from typing import Any, List, Dict
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func
from sqlmodel import Session, select
from src.router.schemas.credits import AddCreditRequest
from src.router.core.security import supabase, verify_admin
from src.router.models.user import UserCreditsHistory, UserCredits
from src.router.db.session import get_session
from enum import Enum
from gotrue.types import User
from datetime import datetime
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


@router.get(
    "/users",
    summary="List Users",
    description="Retrieve a paginated list of users with optional search.",
)
def list_users(
    page: int = 1,
    per_page: int = 10,
    search: str = "",
    user: User = Depends(verify_admin),
    db: Session = Depends(get_session),
):
    offset = (page - 1) * per_page
    query = select(UserModel)

    if search:
        search = f"%{search}%"
        query = query.where(
            (UserModel.full_name.ilike(search)) | (UserModel.email.ilike(search))
        )

    users = db.exec(query.offset(offset).limit(per_page))

    # Get total count for pagination
    total_users = db.exec(select(func.count(UserModel.id))).first()

    return {
        "users": users.all(),
        "total": total_users,
        "page": page,
        "per_page": per_page,
    }


class UserMetadata(BaseModel):
    avatar_url: str
    custom_claims: Dict[str, str]
    email: str
    email_verified: bool
    full_name: str
    iss: str
    name: str
    phone_verified: bool
    picture: str
    provider_id: str
    sub: str


class AppMetadata(BaseModel):
    provider: str
    providers: List[str]


class Claims(BaseModel):
    iss: str
    sub: str
    aud: str
    exp: int
    iat: int
    email: str
    phone: str
    app_metadata: AppMetadata
    user_metadata: UserMetadata
    role: str
    aal: str
    amr: List[Dict[str, str]]
    session_id: str
    is_anonymous: bool


class UserClaimWebhook(BaseModel):
    user_id: str
    claims: dict


def process_user_claims(claims: Claims) -> dict:
    metadata = claims.get("user_metadata", {})
    app_metadata = claims.get("app_metadata", {})

    return {
        "email": metadata.get("email"),
        "full_name": metadata.get("full_name"),
        "avatar_url": metadata.get("avatar_url"),
        "provider": app_metadata.get("provider", ""),
        "meta": {"user_metadata": metadata, "app_metadata": app_metadata},
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
    # TODO: Implement webhook signature verification
    # body = await request.body()
    # signature = request.headers.get("webhook-signature")
    # # signature = base64.b64decode(signature).decode("utf-8")
    # verified = verify_supabase_signature(
    #     payload=body.decode("utf-8"), signature=signature
    # )

    # user_claim = db.exec(
    #     select(UserCustomClaim).where(UserCustomClaim.user_id == req.user_id)
    # ).first()

    # Process user information
    user_data = process_user_claims(req.claims)
    user = db.exec(select(UserModel).where(UserModel.user_id == req.user_id)).first()

    if user:
        # Update existing user
        for key, value in user_data.items():
            setattr(user, key, value)
        user.last_login_at = datetime.utcnow()
        user.updated_at = datetime.utcnow()
    else:
        # Create new user
        user = UserModel(user_id=req.user_id, **user_data)
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
    user_credits = db.exec(
        select(UserCredits).where(UserCredits.user_id == user_id)
    ).first()
    if not user_credits:
        return {"credits": 0}
    return {"credits": user_credits.credits}


@router.post("/add-credit")
def add_credit(
    request: AddCreditRequest,
    db: Session = Depends(get_session),
    user=Depends(verify_admin),
):
    user_credits = db.exec(
        select(UserCredits).where(UserCredits.user_id == request.user_id)
    ).first()

    if user_credits:
        user_credits.credits += request.amount
    else:
        user_credits = UserCredits(user_id=request.user_id, credits=request.amount)
        db.add(user_credits)

    credit_history = UserCreditsHistory(
        user_id=request.user_id,
        amount=request.amount,
        description=request.description,
    )
    db.add(credit_history)
    db.commit()

    return {"credits": user_credits.credits}


@router.post(
    "/update-users",
    summary="Update Users from Supabase",
    description="Pull user details from Supabase and update the users table.",
)
def update_users_from_supabase(
    user: User = Depends(verify_admin),
    db: Session = Depends(get_session),
):
    users = supabase.auth.admin.list_users()

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
