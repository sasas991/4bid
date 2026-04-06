from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from ..models.models import Auction, User
from ..schemas import schemas
from .anchor_client import (
    AUCTION_STATUS_CANCELLED,
    AUCTION_STATUS_FINALIZED,
    DEFAULT_PUBKEY,
    DecodedAssetAccount,
    DecodedAuctionAccount,
    anchor_chain_client,
)

LAMPORTS_PER_SOL = 1_000_000_000


def _normalize_pubkey(pubkey: str) -> str | None:
    return None if pubkey == DEFAULT_PUBKEY else pubkey


def _require_hint_match(name: str, hint: str | None, actual: str | None) -> None:
    if hint is None:
        return
    if hint != actual:
        raise ValueError(f"Hint mismatch for {name}")


def _derive_chain_status(
    auction: DecodedAuctionAccount,
    asset: DecodedAssetAccount,
    now: int,
) -> str:
    if auction.status_code == AUCTION_STATUS_CANCELLED:
        return "cancelled"

    if auction.status_code == AUCTION_STATUS_FINALIZED:
        winner = _normalize_pubkey(auction.winner_pubkey)
        if winner and asset.current_owner_pubkey == winner:
            return "settled"
        return "finalized"

    if now < auction.start_ts:
        return "created"
    if now < auction.commit_end_ts:
        return "commit_phase"
    if now < auction.reveal_end_ts:
        return "reveal_phase"
    return "ready_to_finalize"


def _verify_tx_hint(signature: str | None, auction_pubkey: str, label: str) -> int:
    if not signature:
        return 0
    verification = anchor_chain_client.verify_tx_hint_for_auction(signature, auction_pubkey)
    if not verification.ok:
        raise ValueError(f"Unverifiable {label} signature")
    return verification.slot or 0


def build_verified_projection(payload: schemas.AuctionChainSync) -> dict:
    decoded_auction = anchor_chain_client.get_decoded_auction(payload.auction_pubkey)
    decoded_asset = anchor_chain_client.get_decoded_asset(decoded_auction.asset_pubkey)

    if decoded_asset.mint_pubkey != decoded_auction.mint_pubkey:
        raise ValueError("Asset mint mismatch against auction account")
    if decoded_asset.protocol_pubkey != decoded_auction.protocol_pubkey:
        raise ValueError("Asset protocol mismatch against auction account")

    now = int(datetime.now(timezone.utc).timestamp())
    derived_status = _derive_chain_status(decoded_auction, decoded_asset, now)
    derived_winner = _normalize_pubkey(decoded_auction.winner_pubkey)

    _require_hint_match("asset_pubkey", payload.asset_pubkey, decoded_auction.asset_pubkey)
    _require_hint_match("mint_pubkey", payload.mint_pubkey, decoded_auction.mint_pubkey)
    _require_hint_match("seller_pubkey", payload.seller_pubkey, decoded_auction.seller_pubkey)
    _require_hint_match("winner_pubkey", payload.winner_pubkey, derived_winner)
    _require_hint_match("chain_status", payload.chain_status, derived_status)
    _require_hint_match(
        "current_price_lamports",
        str(payload.current_price_lamports) if payload.current_price_lamports is not None else None,
        str(decoded_auction.highest_revealed_bid_lamports),
    )

    finalize_sig_slot = _verify_tx_hint(payload.finalize_signature, payload.auction_pubkey, "finalize")
    settlement_sig_slot = _verify_tx_hint(payload.settlement_signature, payload.auction_pubkey, "settlement")
    cancel_sig_slot = _verify_tx_hint(payload.cancel_signature, payload.auction_pubkey, "cancel")

    projection_slot = max(
        decoded_auction.slot,
        decoded_asset.slot,
        finalize_sig_slot,
        settlement_sig_slot,
        cancel_sig_slot,
    )

    projection = {
        "auction_pubkey": payload.auction_pubkey,
        "asset_pubkey": decoded_auction.asset_pubkey,
        "mint_pubkey": decoded_auction.mint_pubkey,
        "seller_pubkey": decoded_auction.seller_pubkey,
        "winner_pubkey": derived_winner,
        "chain_status": derived_status,
        "current_price_lamports": decoded_auction.highest_revealed_bid_lamports,
        "finalize_signature": payload.finalize_signature if derived_status in {"finalized", "settled"} and payload.finalize_signature else None,
        "settlement_signature": payload.settlement_signature if derived_status == "settled" and payload.settlement_signature else None,
        "cancel_signature": payload.cancel_signature if derived_status == "cancelled" and payload.cancel_signature else None,
        "last_synced_slot": projection_slot,
    }
    return projection


def apply_chain_projection(
    db: Session,
    auction: Auction,
    payload: schemas.AuctionChainSync,
) -> Auction:
    projection = build_verified_projection(payload)

    # Reject stale sync — only accept projections with a newer slot
    if auction.last_synced_slot and projection["last_synced_slot"] < auction.last_synced_slot:
        raise ValueError("Stale sync: projection slot is older than current")

    if auction.auction_pubkey and auction.auction_pubkey != projection["auction_pubkey"]:
        raise ValueError("Auction pubkey cannot be remapped")
    if auction.asset_pubkey and auction.asset_pubkey != projection["asset_pubkey"]:
        raise ValueError("Asset pubkey cannot be remapped")
    if auction.mint_pubkey and auction.mint_pubkey != projection["mint_pubkey"]:
        raise ValueError("Mint pubkey cannot be remapped")
    if auction.seller_pubkey and auction.seller_pubkey != projection["seller_pubkey"]:
        raise ValueError("Seller pubkey cannot be remapped")

    auction.auction_pubkey = projection["auction_pubkey"]
    auction.asset_pubkey = projection["asset_pubkey"]
    auction.mint_pubkey = projection["mint_pubkey"]
    auction.seller_pubkey = projection["seller_pubkey"]
    auction.winner_pubkey = projection["winner_pubkey"]
    auction.chain_status = projection["chain_status"]
    auction.finalize_signature = projection["finalize_signature"]
    auction.settlement_signature = projection["settlement_signature"]
    auction.cancel_signature = projection["cancel_signature"]
    auction.last_synced_slot = projection["last_synced_slot"]
    auction.current_price = projection["current_price_lamports"] / LAMPORTS_PER_SOL

    winner_pubkey = projection["winner_pubkey"]
    if winner_pubkey:
        winner = db.query(User).filter(User.wallet_address == winner_pubkey).first()
        auction.winner_id = winner.id if winner else None
    else:
        auction.winner_id = None

    db.flush()
    db.refresh(auction)
    return auction
