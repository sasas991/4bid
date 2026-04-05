from __future__ import annotations

from sqlalchemy.orm import Session

from ..models.models import Auction, User
from ..schemas import schemas

LAMPORTS_PER_SOL = 1_000_000_000


ON_CHAIN_STATUSES = {
    "created",
    "commit_phase",
    "reveal_phase",
    "ready_to_finalize",
    "finalized",
    "settled",
    "cancelled",
    "refund_available",
}


def apply_chain_projection(
    db: Session,
    auction: Auction,
    payload: schemas.AuctionChainSync,
) -> Auction:
    if payload.chain_status not in ON_CHAIN_STATUSES:
        raise ValueError("Unsupported chain status")

    auction.auction_pubkey = payload.auction_pubkey
    auction.asset_pubkey = payload.asset_pubkey
    auction.mint_pubkey = payload.mint_pubkey
    auction.seller_pubkey = payload.seller_pubkey
    auction.winner_pubkey = payload.winner_pubkey
    auction.chain_status = payload.chain_status
    auction.finalize_signature = payload.finalize_signature
    auction.settlement_signature = payload.settlement_signature
    auction.cancel_signature = payload.cancel_signature
    auction.last_synced_slot = payload.last_synced_slot

    if payload.current_price_lamports is not None:
        auction.current_price = payload.current_price_lamports / LAMPORTS_PER_SOL

    if payload.winner_pubkey:
        winner = db.query(User).filter(User.wallet_address == payload.winner_pubkey).first()
        auction.winner_id = winner.id if winner else None

    db.flush()
    db.refresh(auction)
    return auction
