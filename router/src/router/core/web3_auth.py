from eth_account.messages import encode_defunct
from web3 import Web3
from datetime import datetime, timedelta
import secrets
from typing import Tuple, Optional
from src.router.models.web3_auth import AuthChallengeResponse
from src.router.core.config import SUPABASE_URL, SUPABASE_KEY
from supabase import create_client, Client
from fastapi import HTTPException
import jwt

# Initialize Web3
w3 = Web3()

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def generate_nonce() -> str:
    """Generate a secure random nonce."""
    return secrets.token_hex(32)

def create_auth_message(wallet_address: str, nonce: str) -> str:
    """Create a formatted message for wallet signing."""
    return f"""Welcome to Mira Network!

Please sign this message to authenticate.
This request will not trigger a blockchain transaction or cost any gas fees.

Wallet address: {wallet_address}
Nonce: {nonce}
"""

def generate_auth_challenge(wallet_address: str) -> AuthChallengeResponse:
    """Generate an authentication challenge for a wallet."""
    nonce = generate_nonce()
    message = create_auth_message(wallet_address, nonce)
    expiration = datetime.utcnow() + timedelta(minutes=5)
    
    return AuthChallengeResponse(
        message=message,
        nonce=nonce,
        expiration=expiration
    )

def verify_signature(message: str, signature: str, wallet_address: str) -> bool:
    """Verify that a message was signed by the specified wallet."""
    try:
        # Recover the address from the signature
        message_hash = encode_defunct(text=message)
        recovered_address = w3.eth.account.recover_message(message_hash, signature=signature)
        
        # Compare the recovered address with the claimed address
        return recovered_address.lower() == wallet_address.lower()
    except Exception:
        return False

async def get_or_create_user(wallet_address: str) -> Tuple[str, str]:
    """Get or create a Supabase user for a wallet address.
    Returns (access_token, refresh_token)."""
    try:
        # Check if a user with this wallet exists
        users = supabase.table("user_wallets").select("user_id").eq("wallet_address", wallet_address).execute()
        
        if users.data:
            # User exists, generate new session
            user_id = users.data[0]["user_id"]
            auth_response = supabase.auth.admin.create_session(user_id)
            return auth_response.access_token, auth_response.refresh_token
        
        # Create new user
        email = f"{wallet_address.lower()}@web3.mira.network"
        auth_response = supabase.auth.admin.create_user({
            "email": email,
            "password": secrets.token_urlsafe(32),
            "email_confirm": True,
            "user_metadata": {
                "wallet_address": wallet_address
            }
        })
        
        if not auth_response.user:
            raise HTTPException(status_code=500, detail="Failed to create user")
            
        # Store wallet association
        supabase.table("user_wallets").insert({
            "user_id": auth_response.user.id,
            "wallet_address": wallet_address,
            "is_primary": True
        }).execute()
        
        # Create session
        session = supabase.auth.admin.create_session(auth_response.user.id)
        return session.access_token, session.refresh_token
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

async def link_wallet_to_user(user_id: str, wallet_address: str) -> bool:
    """Link a wallet address to an existing user."""
    try:
        # Check if wallet is already linked
        existing = supabase.table("user_wallets").select("*").eq("wallet_address", wallet_address).execute()
        
        if existing.data:
            raise HTTPException(status_code=400, detail="Wallet already linked to an account")
            
        # Link wallet
        supabase.table("user_wallets").insert({
            "user_id": user_id,
            "wallet_address": wallet_address,
            "is_primary": False
        }).execute()
        
        return True
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) 