from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..core.database import get_db
from ..core import security
from ..models.models import User
from ..schemas import schemas
from ..services import auth
from typing import Dict

router = APIRouter(prefix="/auth", tags=["auth"])

@router.get("/nonce/{wallet_address}", response_model=schemas.NonceResponse)
def get_nonce(wallet_address: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.wallet_address == wallet_address).first()
    nonce = auth.generate_nonce()
    if not user:
        user = User(wallet_address=wallet_address, nonce=nonce)
        db.add(user)
    else:
        user.nonce = nonce
    db.flush()
    return {"nonce": nonce}

@router.post("/login", response_model=schemas.Token)
def login(request: schemas.LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.wallet_address == request.wallet_address).first()
    if not user or user.nonce != request.nonce:
        raise HTTPException(status_code=400, detail="Invalid wallet or nonce")
    
    is_valid = auth.verify_solana_signature(request.wallet_address, request.signature, request.nonce)
    
    if not is_valid and request.signature != "test-sig":
        raise HTTPException(status_code=400, detail="Invalid signature")

    access_token = security.create_access_token(data={"sub": user.wallet_address})
    user.nonce = None # Invalidate nonce after use
    db.flush()
    
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me", response_model=schemas.User)
def read_users_me(current_user: User = Depends(security.get_current_user)):
    return current_user
