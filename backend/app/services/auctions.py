import logging
import math
from datetime import timezone
from typing import Optional

from fastapi import HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from ..models.models import Auction, AuctionStatus, Bid, FileRecord, LotType, User
from ..schemas import schemas
from .anchor_client import (
    AUCTION_STATUS_CANCELLED,
    AUCTION_STATUS_FINALIZED,
    DEFAULT_PUBKEY,
    TREASURY_ADDRESS,
    anchor_chain_client,
)
from .auction_chain_service import apply_chain_projection

logger = logging.getLogger(__name__)


def get_active_auctions(db: Session, skip: int = 0, limit: int = 10):
    auctions = (
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
    for a in auctions:
        _auto_finalize_if_expired(db, a)
    return auctions


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
    # Balance check removed — payment happens only after winning (pay_auction)

    amount_lamports = int(math.floor(amount * 1_000_000_000))

    # Ensure auction is in commit phase on-chain
    import time as _time
    try:
        decoded = anchor_chain_client.get_decoded_auction(auction.auction_pubkey)
    except ValueError:
        raise HTTPException(status_code=400, detail="Auction does not exist on-chain. It may have failed to create.")
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

    # Balance is NOT deducted here — only when the winner confirms payment (pay_auction)

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

    try:
        decoded = anchor_chain_client.get_decoded_auction(auction.auction_pubkey)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to read on-chain auction state: {exc}") from exc

    if decoded.status_code == AUCTION_STATUS_CANCELLED:
        raise HTTPException(status_code=400, detail="Auction is already cancelled on-chain")
    if decoded.status_code == AUCTION_STATUS_FINALIZED:
        raise HTTPException(status_code=400, detail="Auction is already finalized on-chain")

    # Finalize can succeed only after reveal phase, when winner state exists on-chain.
    solana_now = anchor_chain_client.get_block_time()
    if solana_now < decoded.reveal_end_ts:
        raise HTTPException(
            status_code=400,
            detail=f"Auction is not ready for finalize yet. Wait until reveal phase ends in {decoded.reveal_end_ts - solana_now} seconds.",
        )
    if decoded.highest_bidder_pubkey == DEFAULT_PUBKEY or decoded.highest_revealed_bid_lamports <= 0:
        raise HTTPException(
            status_code=400,
            detail="No revealed winning bid on-chain yet, finalize is unavailable.",
        )

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


def decline_payment(db: Session, auction_id: int, user_id: int):
    """Winner declines to pay — auction goes back to cancelled, no money moves."""
    auction = db.query(Auction).filter(Auction.id == auction_id).with_for_update().first()
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    if auction.status != AuctionStatus.FINISHED:
        raise HTTPException(status_code=400, detail="Auction is not awaiting payment")
    if auction.winner_id != user_id:
        raise HTTPException(status_code=403, detail="Only the winner can decline payment")

    auction.status = AuctionStatus.CANCELLED
    auction.winner_id = None
    db.flush()
    db.refresh(auction)
    return auction


def cancel_bid(db: Session, auction_id: int, user_id: int):
    auction = db.query(Auction).filter(Auction.id == auction_id).with_for_update().first()
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    if auction.status != AuctionStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="Auction is not active")

    user_bid = (
        db.query(Bid)
        .filter(Bid.auction_id == auction_id, Bid.user_id == user_id)
        .first()
    )
    if not user_bid:
        raise HTTPException(status_code=404, detail="You have no bid on this auction")

    # Check if someone placed a higher bid
    higher_bid = (
        db.query(Bid)
        .filter(
            Bid.auction_id == auction_id,
            Bid.user_id != user_id,
            Bid.amount > user_bid.amount,
        )
        .first()
    )
    if higher_bid:
        raise HTTPException(
            status_code=400,
            detail="Cannot cancel — someone already placed a higher bid",
        )

    # No balance refund needed — balance is not deducted at bid time

    # If this was the highest bid, reset current_price to starting_price or next highest
    next_highest = (
        db.query(Bid)
        .filter(Bid.auction_id == auction_id, Bid.user_id != user_id)
        .order_by(Bid.amount.desc())
        .first()
    )
    auction.current_price = next_highest.amount if next_highest else auction.starting_price

    db.delete(user_bid)
    db.flush()
    db.refresh(auction)
    return auction


def pay_auction(db: Session, auction_id: int, user_id: int):
    """Winner pays for the auction — deduct from internal balance, credit seller."""
    auction = db.query(Auction).filter(Auction.id == auction_id).with_for_update().first()
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    if auction.status != AuctionStatus.FINISHED:
        raise HTTPException(status_code=400, detail="Auction is not in finished state")
    if auction.winner_id != user_id:
        raise HTTPException(status_code=403, detail="Only the winner can pay")

    price = auction.current_price
    winner = db.query(User).filter(User.id == user_id).with_for_update().first()
    if winner.balance < price:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient balance. Have {winner.balance:.4f} SOL, need {price:.4f} SOL. Top up your balance first.",
        )

    # Deduct from winner, credit seller
    winner.balance -= price
    seller = db.query(User).filter(User.id == auction.owner_id).with_for_update().first()
    if seller:
        seller.balance += price

    auction.status = AuctionStatus.PAID
    db.flush()
    db.refresh(auction)
    return auction


def ship_auction(db: Session, auction_id: int, user_id: int):
    """Owner confirms shipment/service delivery after payment."""
    auction = db.query(Auction).filter(Auction.id == auction_id).with_for_update().first()
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    if auction.owner_id != user_id:
        raise HTTPException(status_code=403, detail="Only the auction owner can confirm shipment")
    if auction.status != AuctionStatus.PAID:
        raise HTTPException(status_code=400, detail="Auction is not in paid state")
    if auction.lot_type == LotType.INFORMATION:
        raise HTTPException(status_code=400, detail="Information lots do not support shipment")

    auction.status = AuctionStatus.SHIPPED
    db.flush()
    db.refresh(auction)
    return auction


def complete_auction(db: Session, auction_id: int, user_id: int):
    """Winner confirms receipt/completion and closes the auction lifecycle."""
    auction = db.query(Auction).filter(Auction.id == auction_id).with_for_update().first()
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    if auction.winner_id != user_id:
        raise HTTPException(status_code=403, detail="Only the winner can confirm completion")
    if auction.status != AuctionStatus.SHIPPED:
        raise HTTPException(status_code=400, detail="Auction is not in shipped state")

    auction.status = AuctionStatus.COMPLETED
    db.flush()
    db.refresh(auction)
    return auction


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


def _auto_finalize_if_expired(db: Session, auction: Auction):
    """If deadline passed and auction is still active, pick the winner automatically."""
    from datetime import datetime
    if auction.status != AuctionStatus.ACTIVE:
        return
    if auction.deadline > datetime.utcnow():
        return

    # Deadline passed — find highest bid
    highest_bid = (
        db.query(Bid)
        .filter(Bid.auction_id == auction.id)
        .order_by(Bid.amount.desc())
        .first()
    )
    if highest_bid:
        auction.status = AuctionStatus.FINISHED
        auction.winner_id = highest_bid.user_id
        auction.current_price = highest_bid.amount
        logger.info("Auto-finalized auction %d, winner user %d", auction.id, highest_bid.user_id)
    else:
        # No bids — cancel
        auction.status = AuctionStatus.CANCELLED
        logger.info("Auto-cancelled auction %d (no bids, deadline passed)", auction.id)

    db.flush()


def get_auction_detail(db: Session, auction_id: int, user_id: int):
    auction = (
        db.query(Auction)
        .options(joinedload(Auction.bids), joinedload(Auction.escrow))
        .filter(Auction.id == auction_id)
        .first()
    )

    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")

    _auto_finalize_if_expired(db, auction)

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
