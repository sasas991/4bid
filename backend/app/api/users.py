from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import case
from ..core.database import get_db
from ..core import security
from ..models.models import FileRecord, User
from ..schemas import schemas
from ..services.auth import verify_solana_signature
from ..services.solana import verify_deposit_transaction

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
    if update.avatar_file_id is not None:
        record = db.query(FileRecord).filter(FileRecord.id == update.avatar_file_id).first()
        if not record:
            raise HTTPException(status_code=404, detail="File not found")
        current_user.avatar_file_id = record.id
    elif update.avatar_url is not None:
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

    # Verify the on-chain transaction actually transferred the claimed amount
    verified_amount = verify_deposit_transaction(
        signature=request.signature,
        expected_sender=current_user.wallet_address,
        expected_amount_sol=request.amount,
    )
    if verified_amount is None:
        raise HTTPException(
            status_code=400,
            detail="Could not verify deposit transaction on-chain",
        )

    # Atomic increment to prevent lost-update race condition
    db.query(User).filter(User.id == current_user.id).update(
        {User.balance: User.balance + verified_amount}
    )
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

    if not current_user.wallet_address:
        raise HTTPException(status_code=400, detail="No wallet linked to this account")

    # Verify the wallet owner actually signed a message authorizing this exact amount
    expected_message = f"Withdraw {request.amount} SOL from 4bid"
    if not verify_solana_signature(current_user.wallet_address, request.signature, expected_message):
        raise HTTPException(status_code=403, detail="Invalid withdrawal signature")

    # Lock the row to prevent concurrent withdrawal race (double-spend)
    locked_user = db.query(User).filter(User.id == current_user.id).with_for_update().first()
    if locked_user.balance < request.amount:
        raise HTTPException(status_code=400, detail="Insufficient balance")

    # Atomic decrement — UPDATE ... SET balance = balance - amount WHERE balance >= amount
    rows = db.query(User).filter(
        User.id == current_user.id,
        User.balance >= request.amount,
    ).update({User.balance: User.balance - request.amount})

    if rows == 0:
        raise HTTPException(status_code=400, detail="Insufficient balance")

    db.flush()
    db.refresh(current_user)
    return current_user
