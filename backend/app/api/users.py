from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..core.database import get_db
from ..core import security
from ..models.models import User
from ..schemas import schemas

router = APIRouter(prefix="/users", tags=["users"])

@router.get("/me", response_model=schemas.User)
def read_users_me(current_user: User = Depends(security.get_current_user)):
    return current_user

@router.patch("/me", response_model=schemas.User)
def update_user_me(
    update: schemas.UserUpdate,
    current_user: User = Depends(security.get_current_user),
    db: Session = Depends(get_db)
):
    if update.username is not None:
        current_user.username = update.username
    if update.bio is not None:
        current_user.bio = update.bio
    if update.avatar_url is not None:
        current_user.avatar_url = update.avatar_url
    
    db.flush()
    db.refresh(current_user)
    return current_user

@router.post("/deposit", response_model=schemas.User)
def deposit_funds(
    request: schemas.DepositRequest,
    current_user: User = Depends(security.get_current_user),
    db: Session = Depends(get_db)
):
    if request.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")

    current_user.balance += request.amount

    db.flush()
    db.refresh(current_user)
    return current_user

@router.post("/withdraw", response_model=schemas.User)
def withdraw_funds(
    request: schemas.WithdrawRequest,
    current_user: User = Depends(security.get_current_user),
    db: Session = Depends(get_db)
):
    if request.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")
    
    if current_user.balance < request.amount:
        raise HTTPException(status_code=400, detail="Insufficient balance")
    
    # In a real app, we'd trigger a Solana transfer from platform wallet to user wallet
    # Here we just decrease the internal balance
    current_user.balance -= request.amount
    
    db.flush()
    db.refresh(current_user)
    return current_user
