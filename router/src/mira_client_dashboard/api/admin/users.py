from typing import List
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select
from src.mira_client_dashboard.core.security import supabase, verify_admin
from src.mira_client_dashboard.models.user import UserCustomClaim, UserCredits
from src.mira_client_dashboard.db.session import get_session
from enum import Enum
from gotrue.types import User

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
    description="Retrieve a paginated list of users.",
)
def list_users(
    page: int = 1,
    per_page: int = 10,
    user: User = Depends(verify_admin),
):
    return supabase.auth.admin.list_users(page=page, per_page=per_page)


class UserClaimWebhook(BaseModel):
    user_id: str
    claims: dict


@router.post(
    "/user-claims",
    summary="Supabase User Claim Webhook",
    description="Return the updated claims for a user.",
)
async def add_or_update_user_claim(
    # request: Request,
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

    claims = req.claims
    user_metadata = claims.get("user_metadata")
    custom_claims = user_metadata.get("custom_claims")

    user_claim = db.exec(
        select(UserCustomClaim).where(UserCustomClaim.user_id == req.user_id)
    ).first()

    if user_claim:
        custom_claims.update(user_claim.claim)
    else:
        # Don't login the user if they don't have any roles
        raise HTTPException(status_code=401, detail="User doesn't have any roles yet")

    user_metadata.update({"custom_claims": custom_claims})
    claims.update({"user_metadata": user_metadata})

    data = {"user_id": req.user_id, "claims": claims}
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
) -> UserCustomClaim:
    user_claim = db.exec(
        select(UserCustomClaim).where(UserCustomClaim.user_id == user_id)
    ).first()
    if user_claim:
        user_claim.claim = claim.model_dump()
    else:
        user_claim = UserCustomClaim(user_id=user_id, claim=claim.model_dump())
    db.add(user_claim)
    db.commit()
    db.refresh(user_claim)
    return user_claim


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
    user_claim = db.exec(
        select(UserCustomClaim).where(UserCustomClaim.user_id == user_id)
    ).first()
    if not user_claim:
        return {}
    return {
        "claim": user_claim.claim,
        "created_at": user_claim.created_at,
        "user_id": user_claim.user_id,
        "id": user_claim.id,
        "deleted_at": user_claim.deleted_at,
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
