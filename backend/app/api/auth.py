from fastapi import APIRouter, Depends, HTTPException
import httpx
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..core import security
from ..core.config import settings
from ..core.database import get_db
from ..models.models import User
from ..schemas import schemas
from ..services import auth
from ..services.google_auth import verify_google_token

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/nonce/{wallet_address}", response_model=schemas.NonceResponse)
def get_nonce(wallet_address: str, db: Session = Depends(get_db)):
    # Lock existing row to prevent duplicate user creation race
    user = db.query(User).filter(
        User.wallet_address == wallet_address
    ).with_for_update().first()
    nonce = auth.generate_nonce()
    if not user:
        user = User(wallet_address=wallet_address, nonce=nonce)
        db.add(user)
        try:
            db.flush()
        except IntegrityError:
            db.rollback()
            user = db.query(User).filter(
                User.wallet_address == wallet_address
            ).with_for_update().first()
            user.nonce = nonce
            db.flush()
    else:
        user.nonce = nonce
        db.flush()
    return {"nonce": nonce}


@router.post("/login", response_model=schemas.Token)
def login(request: schemas.LoginRequest, db: Session = Depends(get_db)):
    # Lock row to atomically consume the nonce (prevent replay)
    user = db.query(User).filter(
        User.wallet_address == request.wallet_address
    ).with_for_update().first()
    if not user or user.nonce != request.nonce:
        raise HTTPException(status_code=400, detail="Invalid wallet or nonce")

    # Consume nonce immediately before signature verification to prevent concurrent use
    consumed_nonce = user.nonce
    user.nonce = None
    db.flush()

    is_valid = auth.verify_solana_signature(
        request.wallet_address,
        request.signature,
        consumed_nonce,
    )
    if not is_valid:
        raise HTTPException(status_code=400, detail="Invalid signature")

    access_token = security.create_access_token(data={"sub": str(user.id)})
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/google", response_model=schemas.Token)
async def google_login(
    request: schemas.GoogleLoginRequest,
    db: Session = Depends(get_db),
):
    try:
        google_user = await verify_google_token(request.token)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except httpx.HTTPError:
        raise HTTPException(
            status_code=502,
            detail="Unable to verify Google token right now",
        )

    # Lock existing row to prevent duplicate account creation race
    user = db.query(User).filter(
        User.google_id == google_user.google_id
    ).with_for_update().first()

    if not user:
        user = db.query(User).filter(
            User.email == google_user.email
        ).with_for_update().first()
        if user:
            user.google_id = google_user.google_id
        else:
            user = User(
                google_id=google_user.google_id,
                email=google_user.email,
                username=google_user.name,
                avatar_url=google_user.picture,
            )
            db.add(user)
        try:
            db.flush()
        except IntegrityError:
            db.rollback()
            user = db.query(User).filter(
                User.google_id == google_user.google_id
            ).first()
            if not user:
                raise HTTPException(status_code=409, detail="Account conflict, please retry")

    access_token = security.create_access_token(data={"sub": str(user.id)})
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/dev-login", response_model=schemas.Token)
def dev_login(db: Session = Depends(get_db)):
    """Return a JWT for a fixed dev user. Only available when DEV_AUTH_BYPASS=true."""
    if not settings.DEV_AUTH_BYPASS:
        raise HTTPException(status_code=404, detail="Not found")

    user = db.query(User).filter(User.email == "dev@localhost").with_for_update().first()
    if not user:
        user = User(email="dev@localhost", username="Dev User")
        db.add(user)
        try:
            db.flush()
        except IntegrityError:
            db.rollback()
            user = db.query(User).filter(User.email == "dev@localhost").first()
        db.refresh(user)

    access_token = security.create_access_token(data={"sub": str(user.id)})
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/link-wallet", response_model=schemas.User)
def link_wallet(
    request: schemas.LinkWalletRequest,
    current_user: User = Depends(security.get_current_user),
    db: Session = Depends(get_db),
):
    """Link a Solana wallet to the currently authenticated user."""
    # Re-fetch with lock to prevent concurrent linking
    locked_user = db.query(User).filter(User.id == current_user.id).with_for_update().first()
    if locked_user.wallet_address:
        raise HTTPException(status_code=400, detail="Wallet already linked")

    # Lock any existing row with this wallet to prevent two users linking the same wallet
    existing = db.query(User).filter(
        User.wallet_address == request.wallet_address
    ).with_for_update().first()
    if existing:
        raise HTTPException(status_code=400, detail="Wallet already used by another account")

    if locked_user.nonce != request.nonce:
        raise HTTPException(status_code=400, detail="Invalid nonce")

    is_valid = auth.verify_solana_signature(
        request.wallet_address,
        request.signature,
        request.nonce,
    )
    if not is_valid:
        raise HTTPException(status_code=400, detail="Invalid signature")

    locked_user.wallet_address = request.wallet_address
    locked_user.nonce = None
    try:
        db.flush()
    except IntegrityError:
        raise HTTPException(status_code=409, detail="Wallet already used by another account")
    db.refresh(locked_user)
    return locked_user


@router.get("/link-wallet/nonce", response_model=schemas.NonceResponse)
def get_link_wallet_nonce(
    current_user: User = Depends(security.get_current_user),
    db: Session = Depends(get_db),
):
    """Generate a nonce for wallet linking (stored on the current user)."""
    if current_user.wallet_address:
        raise HTTPException(status_code=400, detail="Wallet already linked")
    nonce = auth.generate_nonce()
    current_user.nonce = nonce
    db.flush()
    return {"nonce": nonce}


@router.get("/me", response_model=schemas.User)
def read_users_me(
    current_user: User = Depends(security.get_current_user),
):
    return current_user
