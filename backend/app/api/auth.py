from fastapi import APIRouter, Depends, HTTPException
import httpx
from sqlalchemy.orm import Session

from ..core import security
from ..core.config import settings
from ..core.database import get_db
from ..models.models import User, Auction, Bid
from ..schemas import schemas
from ..services import auth
from ..services.google_auth import verify_google_token

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/nonce/{wallet_address}", response_model=schemas.NonceResponse)
def get_nonce(wallet_address: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(
        User.wallet_address == wallet_address
    ).first()
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
    user = db.query(User).filter(
        User.wallet_address == request.wallet_address
    ).first()
    if not user or user.nonce != request.nonce:
        raise HTTPException(status_code=400, detail="Invalid wallet or nonce")

    is_valid = auth.verify_solana_signature(
        request.wallet_address,
        request.signature,
        request.nonce,
    )
    if not is_valid:
        raise HTTPException(status_code=400, detail="Invalid signature")

    access_token = security.create_access_token(data={"sub": str(user.id)})
    user.nonce = None
    db.flush()

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

    user = db.query(User).filter(
        User.google_id == google_user.google_id
    ).first()

    if not user:
        # Check if a user with this email already exists (link accounts)
        user = db.query(User).filter(
            User.email == google_user.email
        ).first()
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
        db.flush()

    access_token = security.create_access_token(data={"sub": str(user.id)})
    return {"access_token": access_token, "token_type": "bearer"}


def _merge_wallet_user(db: Session, target: User, wallet_user: User):
    """Merge a wallet-only stub user into the target user.

    Moves auctions, bids, and balance from wallet_user to target,
    then deletes the stub.
    """
    # Re-assign owned auctions
    db.query(Auction).filter(Auction.owner_id == wallet_user.id).update(
        {Auction.owner_id: target.id}
    )
    # Re-assign won auctions
    db.query(Auction).filter(Auction.winner_id == wallet_user.id).update(
        {Auction.winner_id: target.id}
    )
    # Re-assign bids
    db.query(Bid).filter(Bid.user_id == wallet_user.id).update(
        {Bid.user_id: target.id}
    )
    # Transfer balance
    target.balance += wallet_user.balance
    # Move wallet address
    target.wallet_address = wallet_user.wallet_address
    # Remove wallet from stub so unique constraint doesn't fire on delete
    wallet_user.wallet_address = None
    db.flush()
    db.delete(wallet_user)
    db.flush()


@router.get("/link-wallet/nonce/{wallet_address}", response_model=schemas.NonceResponse)
def get_link_wallet_nonce(
    wallet_address: str,
    current_user: User = Depends(security.get_current_user),
    db: Session = Depends(get_db),
):
    """Generate a nonce for linking a wallet to the current authenticated user."""
    existing = db.query(User).filter(
        User.wallet_address == wallet_address,
        User.id != current_user.id,
    ).first()
    if existing and existing.google_id:
        raise HTTPException(
            status_code=400,
            detail="Wallet already linked to another Google account",
        )

    current_user.nonce = auth.generate_nonce()
    db.flush()
    return {"nonce": current_user.nonce}


@router.post("/link-wallet", response_model=schemas.User)
def link_wallet(
    request: schemas.LinkWalletRequest,
    current_user: User = Depends(security.get_current_user),
    db: Session = Depends(get_db),
):
    """Link a Solflare wallet to the current authenticated user."""
    if current_user.nonce != request.nonce:
        raise HTTPException(status_code=400, detail="Invalid nonce")

    is_valid = auth.verify_solana_signature(
        request.wallet_address,
        request.signature,
        request.nonce,
    )
    if not is_valid:
        raise HTTPException(status_code=400, detail="Invalid signature")

    existing = db.query(User).filter(
        User.wallet_address == request.wallet_address,
        User.id != current_user.id,
    ).first()

    if existing:
        if existing.google_id:
            raise HTTPException(
                status_code=400,
                detail="Wallet already linked to another Google account",
            )
        # Merge wallet-only stub into current user
        _merge_wallet_user(db, current_user, existing)
    else:
        current_user.wallet_address = request.wallet_address

    current_user.nonce = None
    db.flush()
    db.refresh(current_user)
    return current_user


@router.post("/dev-login", response_model=schemas.Token)
def dev_login(db: Session = Depends(get_db)):
    """Return a JWT for a fixed dev user. Only available when DEV_AUTH_BYPASS=true."""
    if not settings.DEV_AUTH_BYPASS:
        raise HTTPException(status_code=404, detail="Not found")

    user = db.query(User).filter(User.email == "dev@localhost").first()
    if not user:
        user = User(email="dev@localhost", username="Dev User")
        db.add(user)
        db.flush()
        db.refresh(user)

    access_token = security.create_access_token(data={"sub": str(user.id)})
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=schemas.User)
def read_users_me(
    current_user: User = Depends(security.get_current_user),
):
    return current_user
