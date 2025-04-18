from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import select
import uuid
from supabase import create_client, Client
import hashlib
from src.router.utils.nr import track

from src.router.db.session import DBSession
from src.router.models.wallet import Wallet
from src.router.models.user import User
from src.router.core.security import verify_user
from src.router.schemas.wallet import (
    WalletCreate,
    WalletResponse,
    WalletLoginRequest,
    WalletLoginResponse,
)
from src.router.core.config import SUPABASE_URL, SUPABASE_PUBLIC_KEY, JWT_SECRET

from sqlmodel import desc

if not SUPABASE_URL or not SUPABASE_PUBLIC_KEY:
    raise ValueError(
        "SUPABASE_URL and SUPABASE_KEY must be set in environment variables"
    )

if not JWT_SECRET:
    raise ValueError("JWT_SECRET must be set in environment variables")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_PUBLIC_KEY)

# Get the JWT secret from Supabase project settings
SUPABASE_JWT_SECRET = (
    JWT_SECRET  # This should be the JWT secret from your Supabase project settings
)

router = APIRouter()


@router.post("/wallets", response_model=WalletResponse)
async def create_wallet(
    wallet_data: WalletCreate,
    db: DBSession,
    user: User = Depends(verify_user),
) -> Wallet:
    track("create_wallet_request", {
        "user_id": str(user.id),
        "chain": wallet_data.chain
    })
    
    # Check if wallet address already exists
    existing_wallet = await db.exec(
        select(Wallet).where(Wallet.user_id == str(user.id))
    )
    if existing_wallet.one_or_none():
        track("create_wallet_error", {
            "user_id": str(user.id),
            "error": "wallet_already_exists"
        })
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Wallet address already registered",
        )

    # Create new wallet
    new_wallet = Wallet(
        id=uuid.uuid4(),
        address=wallet_data.address,
        chain=wallet_data.chain,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
        user_id=str(user.id),
    )

    db.add(new_wallet)
    await db.commit()
    await db.refresh(new_wallet)

    return new_wallet


@router.get("/wallets", response_model=WalletResponse | None)
async def get_wallets(
    db: DBSession,
    user: User = Depends(verify_user),
) -> Wallet | None:
    """Get all wallets for the current user."""
    track("get_wallets_request", {"user_id": str(user.id)})
    
    result = await db.exec(
        select(Wallet)
        .where(Wallet.user_id == str(user.id))
        .order_by(desc(Wallet.created_at))
    )
    wallet = result.one()
    
    track("get_wallets_response", {
        "user_id": str(user.id),
        "found_wallet": wallet is not None
    })
    
    return wallet


@router.get("/wallets/{wallet_id}", response_model=WalletResponse)
async def get_wallet(
    wallet_id: str,
    db: DBSession,
    user: User = Depends(verify_user),
) -> Wallet:
    """Get a specific wallet by ID."""
    track("get_wallet_request", {
        "user_id": str(user.id),
        "wallet_id": wallet_id
    })

    wallet = await db.exec(select(Wallet).where(Wallet.id == wallet_id))
    wallet = wallet.one()
    if not wallet or wallet.user_id != str(user.id):
        track("get_wallet_error", {
            "user_id": str(user.id),
            "wallet_id": wallet_id,
            "error": "wallet_not_found"
        })
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Wallet not found"
        )
        
    track("get_wallet_response", {
        "user_id": str(user.id),
        "wallet_id": wallet_id
    })
    
    return wallet


@router.delete("/wallets/{wallet_id}")
async def delete_wallet(
    wallet_id: str,
    db: DBSession,
    user: User = Depends(verify_user),
) -> dict:
    """Delete a wallet."""
    track("delete_wallet_request", {
        "user_id": str(user.id),
        "wallet_id": wallet_id
    })

    wallet = await db.exec(select(Wallet).where(Wallet.id == wallet_id))
    wallet = wallet.one()
    if not wallet or wallet.user_id != str(user.id):
        track("delete_wallet_error", {
            "user_id": str(user.id),
            "wallet_id": wallet_id,
            "error": "wallet_not_found"
        })
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Wallet not found"
        )

    await db.delete(wallet)
    await db.commit()
    
    track("delete_wallet_success", {
        "user_id": str(user.id),
        "wallet_id": wallet_id
    })

    return {"message": "Wallet deleted successfully"}


def get_wallet_password(wallet_address: str) -> str:
    """Generate deterministic password for wallet login that fits within 72 bytes."""
    # Create a hash of the wallet address and secret
    hash_input = f"{wallet_address.lower()}{JWT_SECRET}".encode("utf-8")
    # Use SHA-256 and take first 64 characters (32 bytes in hex) to stay well under 72 bytes
    return hashlib.sha256(hash_input).hexdigest()[:64]


@router.post("/wallet/login", response_model=WalletLoginResponse)
async def wallet_login(
    login_data: WalletLoginRequest,
    db: DBSession,
) -> WalletLoginResponse:
    track("wallet_login_request", {
        "address": login_data.address[:8] + "..." # Only track address prefix for safety
    })

    # Normalize the wallet address
    wallet_address = login_data.address.lower()
    wallet_password = get_wallet_password(wallet_address)
    wallet_email = f"{wallet_address}@wallet.mira.network"

    # Check if wallet exists in our database
    result = await db.exec(select(Wallet).where(Wallet.address == wallet_address))
    wallet = result.first()

    if not wallet:
        # Registration path
        try:
            # Sign in the user to get session
            auth_response = supabase.auth.sign_up(
                {
                    "email": wallet_email,
                    "password": wallet_password,
                }
            )

            # Create wallet in our database
            new_wallet = Wallet(
                id=uuid.uuid4(),
                address=wallet_address,
                chain="ethereum",
                user_id=auth_response.user.id,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            await db.add(new_wallet)
            await db.commit()

        except Exception as e:
            track("wallet_registration_error", {"error": str(e)})
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error creating Supabase user: {str(e)}",
            ) from e
    else:
        # Login path
        try:
            # Sign in with password
            auth_response = supabase.auth.sign_in_with_password(
                {
                    "email": wallet_email,
                    "password": wallet_password,
                }
            )

            # Update wallet last login
            wallet.updated_at = datetime.utcnow()
            await db.commit()

        except Exception as e:
            track("wallet_login_error", {"error": str(e)})
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error signing in user: {str(e)}",
            ) from e

    return WalletLoginResponse(
        access_token=auth_response.session.access_token,
        refresh_token=auth_response.session.refresh_token,
        expires_in=auth_response.session.expires_in,
        user_id=auth_response.user.id,
        wallet_address=wallet_address,
    )
