from fastapi import APIRouter, HTTPException, Depends
from src.router.models.web3_auth import (
    WalletSignRequest,
    AuthChallengeResponse,
    Web3AuthResponse
)
from src.router.core.web3_auth import (
    create_auth_message,
    generate_auth_challenge,
    verify_signature,
    get_or_create_user,
    link_wallet_to_user
)
from src.router.core.security import verify_token
from src.router.core.types import User

router = APIRouter(prefix="/web3", tags=["web3-auth"])

@router.post("/challenge/{wallet_address}")
async def get_auth_challenge(wallet_address: str) -> AuthChallengeResponse:
    """Generate an authentication challenge for a wallet address."""
    if not wallet_address.startswith("0x") or len(wallet_address) != 42:
        raise HTTPException(status_code=400, detail="Invalid wallet address")
    
    return generate_auth_challenge(wallet_address)

@router.post("/authenticate")
async def authenticate_wallet(request: WalletSignRequest) -> Web3AuthResponse:
    """Authenticate a wallet using its signature."""
    # Verify the wallet address format
    if not request.wallet_address.startswith("0x") or len(request.wallet_address) != 42:
        raise HTTPException(status_code=400, detail="Invalid wallet address")
    
    # Create the message that was supposed to be signed
    challenge = create_auth_message(request.wallet_address, request.nonce)
    
    # Verify the signature
    if not verify_signature(challenge, request.signature, request.wallet_address):
        raise HTTPException(status_code=401, detail="Invalid signature")
    
    # Get or create user and generate session
    access_token, refresh_token = await get_or_create_user(request.wallet_address)
    
    return Web3AuthResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        wallet_address=request.wallet_address,
        user_id=jwt.decode(access_token, options={"verify_signature": False})["sub"]
    )

@router.post("/link-wallet/{wallet_address}")
async def link_wallet(
    wallet_address: str,
    request: WalletSignRequest,
    current_user: User = Depends(verify_token)
) -> dict:
    """Link a new wallet to an existing account."""
    # Verify the wallet address format
    if not wallet_address.startswith("0x") or len(wallet_address) != 42:
        raise HTTPException(status_code=400, detail="Invalid wallet address")
    
    # Verify that the wallet address matches the request
    if wallet_address.lower() != request.wallet_address.lower():
        raise HTTPException(status_code=400, detail="Wallet address mismatch")
    
    # Create and verify the challenge message
    challenge = create_auth_message(wallet_address, request.nonce)
    if not verify_signature(challenge, request.signature, wallet_address):
        raise HTTPException(status_code=401, detail="Invalid signature")
    
    # Link the wallet to the user
    success = await link_wallet_to_user(current_user.id, wallet_address)
    
    return {"success": success, "message": "Wallet linked successfully"} 