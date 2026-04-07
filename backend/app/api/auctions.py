import logging
import math
import time

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from ..core.database import get_db
from ..core import security
from ..models.models import Auction, User, Bid, AuctionStatus, LotType
from ..schemas import schemas
from ..services import auctions as auction_service
from ..services.anchor_client import anchor_chain_client

logger = logging.getLogger(__name__)

# Approximate rent cost for asset + auction + mint + 2 ATAs (in SOL).
# This is deducted from the user's internal balance to cover the platform keypair's SOL spend.
RENT_COST_SOL = 0.02

router = APIRouter(prefix="/auctions", tags=["auctions"])

@router.get("/", response_model=List[schemas.Auction])
def get_auctions(skip: int = 0, limit: int = 10, db: Session = Depends(get_db)):
    return auction_service.get_active_auctions(db, skip, limit)

@router.post("/", response_model=schemas.Auction)
def create_auction(
    auction: schemas.AuctionCreate,
    current_user: User = Depends(security.get_current_user),
    db: Session = Depends(get_db)
):
    # Deduct rent cost from user's internal balance
    if current_user.balance < RENT_COST_SOL:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient balance for on-chain rent. Need at least {RENT_COST_SOL} SOL, have {current_user.balance:.4f} SOL.",
        )

    # First create on-chain, only then persist to DB
    from datetime import timezone as _tz
    deadline = auction.deadline
    if deadline.tzinfo is not None:
        deadline = deadline.astimezone(_tz.utc).replace(tzinfo=None)
    deadline_ts = int(deadline.timestamp())
    commit_duration = max(deadline_ts - int(time.time()), 60)
    min_bid_lamports = int(math.floor(auction.starting_price * 1_000_000_000))

    try:
        result = anchor_chain_client.create_auction_on_chain(
            title=auction.title,
            metadata_uri=auction.image_url or f"ipfs://4bid/new",
            real_world_ref=f"auction:new",
            min_bid_lamports=min_bid_lamports,
            commit_duration_secs=commit_duration,
            reveal_duration_secs=60,
        )
    except Exception as exc:
        logger.exception("On-chain auction creation failed")
        raise HTTPException(
            status_code=502,
            detail=f"On-chain creation failed: {exc}",
        ) from exc

    # On-chain succeeded — now create DB record
    db_auction = auction_service.create_auction(db, auction, current_user.id)
    db_auction.auction_pubkey = result.auction_pubkey
    db_auction.asset_pubkey = result.asset_pubkey
    db_auction.mint_pubkey = result.mint_pubkey
    db_auction.seller_pubkey = result.seller_pubkey
    db_auction.chain_status = "created"
    db_auction.last_synced_slot = result.slot

    # Deduct rent from user balance
    current_user.balance -= RENT_COST_SOL

    db.flush()
    db.refresh(db_auction)
    return db_auction

@router.get("/my/auctions", response_model=List[schemas.Auction])
def get_my_auctions(
    current_user: User = Depends(security.get_current_user),
    db: Session = Depends(get_db)
):
    return db.query(Auction).options(
        joinedload(Auction.bids),
        joinedload(Auction.escrow),
    ).filter(Auction.owner_id == current_user.id).all()

@router.get("/my/bids", response_model=List[schemas.Bid])
def get_my_bids(
    current_user: User = Depends(security.get_current_user),
    db: Session = Depends(get_db)
):
    return db.query(Bid).filter(Bid.user_id == current_user.id).all()

@router.get("/{auction_id}", response_model=schemas.AuctionDetail)
def get_auction(
    auction_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(security.get_optional_current_user),
):
    user_id = current_user.id if current_user else 0
    auction = auction_service.get_auction_detail(db, auction_id, user_id)

    visible_hidden: Optional[str] = auction.hidden_content
    is_owner = auction.owner_id == user_id
    is_winner = auction.winner_id == user_id
    is_info_lot = auction.lot_type == LotType.INFORMATION

    if not is_owner and not is_winner:
        visible_hidden = None
    # For information lots, winner should get access right after successful payment.
    elif is_info_lot and is_winner and auction.status == AuctionStatus.PAID:
        visible_hidden = auction.hidden_content
    elif (auction.chain_status or "") not in ["finalized", "settled"]:
        if not is_owner:
            visible_hidden = None

    detail = schemas.AuctionDetail.model_validate(auction, from_attributes=True)
    return detail.model_copy(update={"hidden_content": visible_hidden})

@router.delete("/{auction_id}/bids", response_model=schemas.Auction)
def cancel_bid(
    auction_id: int,
    current_user: User = Depends(security.get_current_user),
    db: Session = Depends(get_db),
):
    return auction_service.cancel_bid(db, auction_id, current_user.id)


@router.post("/{auction_id}/bids", response_model=schemas.Bid)
def create_bid(
    auction_id: int,
    bid: schemas.BidCreate,
    current_user: User = Depends(security.get_current_user),
    db: Session = Depends(get_db)
):
    return auction_service.place_bid(db, auction_id, bid, current_user)

@router.post("/{auction_id}/cancel", response_model=schemas.Auction)
def cancel_auction(
    auction_id: int,
    current_user: User = Depends(security.get_current_user),
    db: Session = Depends(get_db),
):
    return auction_service.cancel_auction(db, auction_id, current_user.id)

@router.post("/{auction_id}/finalize", response_model=schemas.Auction)
def finalize_auction(
    auction_id: int,
    current_user: User = Depends(security.get_current_user),
    db: Session = Depends(get_db),
):
    return auction_service.finalize_auction(db, auction_id, current_user.id)

@router.post("/{auction_id}/pay", response_model=schemas.Auction)
def pay_auction(
    auction_id: int,
    current_user: User = Depends(security.get_current_user),
    db: Session = Depends(get_db),
):
    return auction_service.pay_auction(db, auction_id, current_user.id)

@router.post("/{auction_id}/ship", response_model=schemas.Auction)
def ship_auction(
    auction_id: int,
    current_user: User = Depends(security.get_current_user),
    db: Session = Depends(get_db),
):
    return auction_service.ship_auction(db, auction_id, current_user.id)

@router.post("/{auction_id}/complete", response_model=schemas.Auction)
def complete_auction(
    auction_id: int,
    current_user: User = Depends(security.get_current_user),
    db: Session = Depends(get_db),
):
    return auction_service.complete_auction(db, auction_id, current_user.id)

@router.patch("/{auction_id}/status", response_model=schemas.Auction)
def update_auction_status(
    auction_id: int,
    update: schemas.AuctionUpdate,
    current_user: User = Depends(security.get_current_user),
    db: Session = Depends(get_db)
):
    if not update.status:
        raise HTTPException(status_code=400, detail="Status must be provided")
    return auction_service.update_auction_status(db, auction_id, update.status, current_user.id, update.tx_signature)


@router.post("/{auction_id}/chain/sync", response_model=schemas.Auction)
def sync_auction_from_chain(
    auction_id: int,
    payload: schemas.AuctionChainSync,
    current_user: User = Depends(security.get_current_user),
    db: Session = Depends(get_db),
):
    return auction_service.sync_auction_from_chain(
        db=db,
        auction_id=auction_id,
        payload=payload,
        actor_wallet=current_user.wallet_address,
    )
