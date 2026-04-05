from datetime import timezone
from typing import Optional

from fastapi import HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from ..models.models import Auction, AuctionStatus, User
from ..schemas import schemas
from .auction_chain_service import apply_chain_projection


def _on_chain_only(action: str) -> HTTPException:
    return HTTPException(
        status_code=410,
        detail=(
            f"{action} is executed on-chain only. Submit the Anchor instruction "
            "from the wallet client, then sync/read projected state from backend."
        ),
    )


def get_active_auctions(db: Session, skip: int = 0, limit: int = 10):
    return (
        db.query(Auction)
        .filter(
            or_(
                Auction.chain_status.is_(None),
                Auction.chain_status.notin_(["finalized", "settled", "cancelled"]),
            )
        )
        .offset(skip)
        .limit(limit)
        .all()
    )


def create_auction(db: Session, auction: schemas.AuctionCreate, owner_id: int):
    """
    Create metadata/read-model row only.
    Authoritative auction initialization/validation must happen on-chain.
    """
    deadline = auction.deadline
    if deadline.tzinfo is not None:
        deadline = deadline.astimezone(timezone.utc).replace(tzinfo=None)

    owner = db.query(User).filter(User.id == owner_id).first()
    if not owner:
        raise HTTPException(status_code=404, detail="Owner not found")

    db_auction = Auction(
        **auction.model_dump(exclude={"deadline"}),
        deadline=deadline,
        current_price=auction.starting_price,
        owner_id=owner_id,
        status=AuctionStatus.ACTIVE,
        chain_status="pending_create",
        seller_pubkey=owner.wallet_address,
    )
    db.add(db_auction)
    db.flush()
    db.refresh(db_auction)
    return db_auction


def place_bid(db: Session, auction_id: int, bid_data: schemas.BidCreate, user: User):
    raise _on_chain_only("Bid placement")


def finalize_auction(db: Session, auction: Auction):
    raise _on_chain_only("Auction finalization")


def cancel_bid(db: Session, auction_id: int, user_id: int):
    raise _on_chain_only("Bid cancellation")


def update_auction_status(
    db: Session,
    auction_id: int,
    status: AuctionStatus,
    user_id: int,
    tx_signature: Optional[str] = None,
):
    raise _on_chain_only("Auction status transition")


def get_auction_detail(db: Session, auction_id: int, user_id: int):
    auction = (
        db.query(Auction)
        .options(joinedload(Auction.bids), joinedload(Auction.escrow))
        .filter(Auction.id == auction_id)
        .first()
    )

    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")

    return auction


def sync_auction_from_chain(
    db: Session,
    auction_id: int,
    payload: schemas.AuctionChainSync,
    actor_wallet: str,
):
    auction = db.query(Auction).filter(Auction.id == auction_id).first()
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")

    # Owner can sync their auction projection. In practice this can also be done by an indexer worker.
    owner = db.query(User).filter(User.id == auction.owner_id).first()
    if owner and actor_wallet != owner.wallet_address and actor_wallet != payload.seller_pubkey:
        raise HTTPException(status_code=403, detail="Unauthorized chain sync caller")

    try:
        return apply_chain_projection(db, auction, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
