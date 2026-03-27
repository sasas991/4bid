import secrets
from datetime import datetime, timedelta
from typing import Optional
from jose import jwt
from solders.pubkey import Pubkey
from solders.signature import Signature
from fastapi import HTTPException, status, Depends
from sqlalchemy.orm import Session
from ..core.config import settings
from ..core.database import get_db
from ..core.security import create_access_token, get_current_user
from ..models.models import User

def generate_nonce() -> str:
    return secrets.token_hex(16)

def verify_solana_signature(wallet_address: str, signature: str, message: str) -> bool:
    try:
        pubkey = Pubkey.from_string(wallet_address)
        sig = Signature.from_string(signature)
        return sig.verify(pubkey, message.encode())
    except Exception as e:
        print(f"Signature verification failed: {e}")
        return False
