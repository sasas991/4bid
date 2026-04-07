import logging
import math
from datetime import timezone
from typing import Optional

from fastapi import HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from ..models.models import Auction, AuctionStatus, Bid, FileRecord, User
from ..schemas import schemas
from .anchor_client import anchor_chain_client, TREASURY_ADDRESS
from .auction_chain_service import apply_chain_projection

logger = logging.getLogger(__name__)


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

    image_file_id: int | None = None
    if auction.image_file_id is not None:
        file_record = db.query(FileRecord).filter(FileRecord.id == auction.image_file_id).first()
        if not file_record:
            raise HTTPException(status_code=404, detail="Image file not found")
        image_file_id = file_record.id

    db_auction = Auction(
        **auction.model_dump(exclude={"deadline", "image_file_id"}),
        deadline=deadline,
        image_file_id=image_file_id,
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
    """Place a bid: deduct balance, submit on-chain commit_bid, record in DB."""
    auction = db.query(Auction).filter(Auction.id == auction_id).with_for_update().first()
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    if auction.status != AuctionStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="Auction is not active")
    if not auction.auction_pubkey:
        raise HTTPException(status_code=400, detail="Auction is not synced on-chain yet")
    if user.id == auction.owner_id:
        raise HTTPException(status_code=400, detail="Cannot bid on your own auction")

    amount = bid_data.amount
    if amount < auction.starting_price:
        raise HTTPException(status_code=400, detail=f"Bid must be at least {auction.starting_price} SOL")
    if amount <= auction.current_price and auction.current_price > auction.starting_price:
        raise HTTPException(status_code=400, detail=f"Bid must exceed current price of {auction.current_price} SOL")
    if user.balance < amount:
        raise HTTPException(status_code=400, detail=f"Insufficient balance. Have {user.balance:.4f} SOL, need {amount:.4f} SOL")

    amount_lamports = int(math.floor(amount * 1_000_000_000))

    # Ensure auction is in commit phase on-chain
    import time as _time
    decoded = anchor_chain_client.get_decoded_auction(auction.auction_pubkey)
    if decoded.status_code >= 3:  # Finalized or Cancelled
        raise HTTPException(status_code=400, detail="Auction is no longer accepting bids")

    solana_now = anchor_chain_client.get_block_time()
    logger.info(
        "Bid phase check: solana_now=%d start_ts=%d commit_end=%d status=%d",
        solana_now, decoded.start_ts, decoded.commit_end_ts, decoded.status_code,
    )

    if solana_now < decoded.start_ts:
        wait = decoded.start_ts - solana_now + 1
        if wait > 30:
            raise HTTPException(status_code=400, detail="Auction commit phase has not started yet")
        _time.sleep(min(wait, 10))
        solana_now = anchor_chain_client.get_block_time()

    if solana_now >= decoded.commit_end_ts:
        raise HTTPException(
            status_code=400,
            detail=f"Auction commit phase has ended (solana_now={solana_now}, commit_end={decoded.commit_end_ts}, started={decoded.start_ts})",
        )

    try:
        result = anchor_chain_client.commit_bid_on_chain(
            auction_pubkey=auction.auction_pubkey,
            amount_lamports=amount_lamports,
        )
    except Exception as exc:
        logger.exception("On-chain commit_bid failed for auction %s", auction_id)
        raise HTTPException(status_code=502, detail=f"On-chain bid failed: {exc}") from exc

    # Deduct from user balance
    user.balance -= amount

    # Update auction current price
    auction.current_price = amount
    auction.chain_status = "commit_phase"
    auction.last_synced_slot = result.slot

    # Record bid in DB
    db_bid = Bid(
        amount=amount,
        signature=result.signature,
        bid_commit_pubkey=result.bid_commit_pubkey,
        commit_signature=result.signature,
        on_chain=1,
        user_id=user.id,
        auction_id=auction_id,
    )
    db.add(db_bid)
    db.flush()
    db.refresh(db_bid)
    return db_bid


def cancel_auction(db: Session, auction_id: int, user_id: int):
    """Cancel an auction on-chain and update DB status."""
    auction = db.query(Auction).filter(Auction.id == auction_id).with_for_update().first()
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    if auction.owner_id != user_id:
        raise HTTPException(status_code=403, detail="Only the auction owner can cancel")
    if auction.status == AuctionStatus.CANCELLED:
        raise HTTPException(status_code=400, detail="Auction is already cancelled")
    if not auction.auction_pubkey or not auction.asset_pubkey or not auction.mint_pubkey:
        raise HTTPException(status_code=400, detail="Auction is missing on-chain data")

    try:
        result = anchor_chain_client.cancel_auction_on_chain(
            auction_pubkey=auction.auction_pubkey,
            asset_pubkey=auction.asset_pubkey,
            mint_pubkey=auction.mint_pubkey,
        )
    except Exception as exc:
        logger.exception("On-chain cancel_auction failed for auction %s", auction_id)
        raise HTTPException(status_code=502, detail=f"On-chain cancel failed: {exc}") from exc

    auction.status = AuctionStatus.CANCELLED
    auction.chain_status = "cancelled"
    auction.cancel_signature = result.signature
    auction.last_synced_slot = result.slot
    db.flush()
    db.refresh(auction)
    return auction


def finalize_auction(db: Session, auction_id: int, user_id: int):
    """Finalize an auction on-chain and update DB status."""
    auction = db.query(Auction).filter(Auction.id == auction_id).with_for_update().first()
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    if auction.owner_id != user_id:
        raise HTTPException(status_code=403, detail="Only the auction owner can finalize")
    if not auction.auction_pubkey or not auction.seller_pubkey:
        raise HTTPException(status_code=400, detail="Auction is missing on-chain data")

    treasury = TREASURY_ADDRESS

    try:
        result = anchor_chain_client.finalize_auction_on_chain(
            auction_pubkey=auction.auction_pubkey,
            seller_pubkey=auction.seller_pubkey,
            treasury_pubkey=treasury,
        )
    except Exception as exc:
        logger.exception("On-chain finalize_auction failed for auction %s", auction_id)
        raise HTTPException(status_code=502, detail=f"On-chain finalize failed: {exc}") from exc

    auction.status = AuctionStatus.FINISHED
    auction.chain_status = "finalized"
    auction.finalize_signature = result.signature
    auction.last_synced_slot = result.slot
    db.flush()
    db.refresh(auction)
    return auction


def cancel_bid(db: Session, auction_id: int, user_id: int):
    raise HTTPException(
        status_code=400,
        detail="Bid cancellation is not supported. Funds are refunded automatically after auction ends.",
    )


def update_auction_status(
    db: Session,
    auction_id: int,
    status: AuctionStatus,
    user_id: int,
    tx_signature: Optional[str] = None,
):
    raise HTTPException(
        status_code=410,
        detail="Direct status transitions are disabled. Use the dedicated bid/cancel/finalize endpoints.",
    )


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
    actor_wallet: Optional[str],
):
    # Lock auction row to prevent concurrent sync races overwriting winner/state
    auction = db.query(Auction).filter(Auction.id == auction_id).with_for_update().first()
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")

    # Owner, seller, or any authenticated bidder may sync the projection.
    # The chain service itself validates all data against on-chain state,
    # so allowing any participant to trigger sync is safe.

    try:
        return apply_chain_projection(db, auction, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Chain RPC error: {exc}") from exc
