from datetime import datetime, timedelta

from app.services.anchor_client import (
    AUCTION_STATUS_FINALIZED,
    DecodedAssetAccount,
    DecodedAuctionAccount,
    TxVerificationResult,
)


def _set_client_user(client, user):
    from app.core.security import get_current_user, get_optional_current_user

    client.app.dependency_overrides[get_current_user] = lambda: user
    client.app.dependency_overrides[get_optional_current_user] = lambda: user


def _create_auction(client):
    deadline = (datetime.utcnow() + timedelta(days=1)).isoformat()
    created = client.post(
        "/api/auctions/",
        json={
            "title": "On-chain Auction",
            "description": "metadata only",
            "lot_type": "information",
            "hidden_content": "secret",
            "starting_price": 5.0,
            "deadline": deadline,
        },
    )
    assert created.status_code == 200
    return created.json()["id"]


def test_critical_write_paths_are_on_chain_only(client, seller_user):
    _set_client_user(client, seller_user)
    auction_id = _create_auction(client)

    bid_res = client.post(
        f"/api/auctions/{auction_id}/bids",
        json={"amount": 6.0, "signature": "irrelevant", "auction_id": auction_id},
    )
    assert bid_res.status_code == 410

    cancel_res = client.delete(f"/api/auctions/{auction_id}/bids")
    assert cancel_res.status_code == 410

    status_res = client.patch(
        f"/api/auctions/{auction_id}/status",
        json={"status": "finished", "tx_signature": "sig"},
    )
    assert status_res.status_code == 410


def test_chain_sync_rejects_mismatched_client_hints(client, monkeypatch, seller_user):
    from app.services import auction_chain_service as chain_service

    _set_client_user(client, seller_user)
    auction_id = _create_auction(client)

    auction_pubkey = "7v3fY4aJPQjvWm21U6jvV3vfgjmfX8o3Yf6xwSYhQ3jS"
    asset_pubkey = "2vPpAtp3LhQhEn8Mo7VNHQz1hYJmVzjM9u6bD1M3YQ4o"
    mint_pubkey = "5kHNR5hV1Jx7LhV9Lg3fV8hLGrME6NwEi9e8bJ3fN6r9"
    winner_pubkey = "8Nf6fXTyP6kqvAqfr9V9aV5q7xD2e8qvA9e3xYwZ6KpQ"
    highest_bidder = "7h6kP8Qm3xV2N4cD9eF1gH3jK5mL7nP9qR2sT4uV6wX8"

    monkeypatch.setattr(
        chain_service.anchor_chain_client,
        "get_decoded_auction",
        lambda _pubkey: DecodedAuctionAccount(
            auction_pubkey=auction_pubkey,
            protocol_pubkey="9wK2bG6fD1mP4rS8tV3xY7zQ5nL2kJ9hF6dC4bA8eR1",
            asset_pubkey=asset_pubkey,
            mint_pubkey=mint_pubkey,
            seller_pubkey=seller_user.wallet_address,
            winner_pubkey=winner_pubkey,
            highest_bidder_pubkey=highest_bidder,
            start_ts=1,
            commit_end_ts=2,
            reveal_end_ts=3,
            min_bid_lamports=1_000_000_000,
            highest_revealed_bid_lamports=2_500_000_000,
            status_code=AUCTION_STATUS_FINALIZED,
            settled=True,
            slot=111,
        ),
    )
    monkeypatch.setattr(
        chain_service.anchor_chain_client,
        "get_decoded_asset",
        lambda _pubkey: DecodedAssetAccount(
            asset_pubkey=asset_pubkey,
            protocol_pubkey="9wK2bG6fD1mP4rS8tV3xY7zQ5nL2kJ9hF6dC4bA8eR1",
            mint_pubkey=mint_pubkey,
            current_owner_pubkey=winner_pubkey,
            slot=112,
        ),
    )
    monkeypatch.setattr(
        chain_service.anchor_chain_client,
        "verify_tx_hint_for_auction",
        lambda _sig, _auction: TxVerificationResult(ok=True, slot=120),
    )

    sync_res = client.post(
        f"/api/auctions/{auction_id}/chain/sync",
        json={
            "auction_pubkey": auction_pubkey,
            "seller_pubkey": "WrongSeller11111111111111111111111111111111",
            "chain_status": "cancelled",
        },
    )
    assert sync_res.status_code == 400
    assert "Hint mismatch" in sync_res.json()["detail"]


def test_chain_sync_updates_only_from_verified_chain_state(client, db, test_user, seller_user, monkeypatch):
    from app.models.models import Auction
    from app.services import auction_chain_service as chain_service

    _set_client_user(client, seller_user)
    auction_id = _create_auction(client)

    auction_pubkey = "7v3fY4aJPQjvWm21U6jvV3vfgjmfX8o3Yf6xwSYhQ3jS"
    asset_pubkey = "2vPpAtp3LhQhEn8Mo7VNHQz1hYJmVzjM9u6bD1M3YQ4o"
    mint_pubkey = "5kHNR5hV1Jx7LhV9Lg3fV8hLGrME6NwEi9e8bJ3fN6r9"
    highest_bidder = "7h6kP8Qm3xV2N4cD9eF1gH3jK5mL7nP9qR2sT4uV6wX8"

    monkeypatch.setattr(
        chain_service.anchor_chain_client,
        "get_decoded_auction",
        lambda _pubkey: DecodedAuctionAccount(
            auction_pubkey=auction_pubkey,
            protocol_pubkey="9wK2bG6fD1mP4rS8tV3xY7zQ5nL2kJ9hF6dC4bA8eR1",
            asset_pubkey=asset_pubkey,
            mint_pubkey=mint_pubkey,
            seller_pubkey=seller_user.wallet_address,
            winner_pubkey=test_user.wallet_address,
            highest_bidder_pubkey=highest_bidder,
            start_ts=1,
            commit_end_ts=2,
            reveal_end_ts=3,
            min_bid_lamports=1_000_000_000,
            highest_revealed_bid_lamports=2_500_000_000,
            status_code=AUCTION_STATUS_FINALIZED,
            settled=True,
            slot=400,
        ),
    )
    monkeypatch.setattr(
        chain_service.anchor_chain_client,
        "get_decoded_asset",
        lambda _pubkey: DecodedAssetAccount(
            asset_pubkey=asset_pubkey,
            protocol_pubkey="9wK2bG6fD1mP4rS8tV3xY7zQ5nL2kJ9hF6dC4bA8eR1",
            mint_pubkey=mint_pubkey,
            current_owner_pubkey=test_user.wallet_address,
            slot=410,
        ),
    )

    def _verify_tx(sig, _auction):
        if sig == "finalize_sig":
            return TxVerificationResult(ok=True, slot=420)
        if sig == "settle_sig":
            return TxVerificationResult(ok=True, slot=430)
        return TxVerificationResult(ok=False, slot=None)

    monkeypatch.setattr(
        chain_service.anchor_chain_client,
        "verify_tx_hint_for_auction",
        _verify_tx,
    )

    sync_res = client.post(
        f"/api/auctions/{auction_id}/chain/sync",
        json={
            "auction_pubkey": auction_pubkey,
            "winner_pubkey": test_user.wallet_address,
            "finalize_signature": "finalize_sig",
            "settlement_signature": "settle_sig",
            "chain_status": "settled",
        },
    )
    assert sync_res.status_code == 200

    db_auction = db.query(Auction).filter(Auction.id == auction_id).first()
    assert db_auction is not None
    assert db_auction.auction_pubkey == auction_pubkey
    assert db_auction.asset_pubkey == asset_pubkey
    assert db_auction.mint_pubkey == mint_pubkey
    assert db_auction.seller_pubkey == seller_user.wallet_address
    assert db_auction.winner_pubkey == test_user.wallet_address
    assert db_auction.winner_id == test_user.id
    assert db_auction.chain_status == "settled"
    assert db_auction.current_price == 2.5
    assert db_auction.finalize_signature == "finalize_sig"
    assert db_auction.settlement_signature == "settle_sig"
    assert db_auction.cancel_signature is None
    assert db_auction.last_synced_slot == 430


def test_chain_sync_rejects_unverifiable_signature_hint(client, monkeypatch, seller_user):
    from app.services import auction_chain_service as chain_service

    _set_client_user(client, seller_user)
    auction_id = _create_auction(client)

    auction_pubkey = "7v3fY4aJPQjvWm21U6jvV3vfgjmfX8o3Yf6xwSYhQ3jS"
    asset_pubkey = "2vPpAtp3LhQhEn8Mo7VNHQz1hYJmVzjM9u6bD1M3YQ4o"
    mint_pubkey = "5kHNR5hV1Jx7LhV9Lg3fV8hLGrME6NwEi9e8bJ3fN6r9"

    monkeypatch.setattr(
        chain_service.anchor_chain_client,
        "get_decoded_auction",
        lambda _pubkey: DecodedAuctionAccount(
            auction_pubkey=auction_pubkey,
            protocol_pubkey="9wK2bG6fD1mP4rS8tV3xY7zQ5nL2kJ9hF6dC4bA8eR1",
            asset_pubkey=asset_pubkey,
            mint_pubkey=mint_pubkey,
            seller_pubkey=seller_user.wallet_address,
            winner_pubkey="11111111111111111111111111111111",
            highest_bidder_pubkey="11111111111111111111111111111111",
            start_ts=1,
            commit_end_ts=2,
            reveal_end_ts=3,
            min_bid_lamports=1_000_000_000,
            highest_revealed_bid_lamports=2_000_000_000,
            status_code=AUCTION_STATUS_FINALIZED,
            settled=True,
            slot=111,
        ),
    )
    monkeypatch.setattr(
        chain_service.anchor_chain_client,
        "get_decoded_asset",
        lambda _pubkey: DecodedAssetAccount(
            asset_pubkey=asset_pubkey,
            protocol_pubkey="9wK2bG6fD1mP4rS8tV3xY7zQ5nL2kJ9hF6dC4bA8eR1",
            mint_pubkey=mint_pubkey,
            current_owner_pubkey=seller_user.wallet_address,
            slot=112,
        ),
    )
    monkeypatch.setattr(
        chain_service.anchor_chain_client,
        "verify_tx_hint_for_auction",
        lambda _sig, _auction: TxVerificationResult(ok=False, slot=None),
    )

    sync_res = client.post(
        f"/api/auctions/{auction_id}/chain/sync",
        json={
            "auction_pubkey": auction_pubkey,
            "finalize_signature": "bogus_sig",
        },
    )
    assert sync_res.status_code == 400
    assert "Unverifiable finalize signature" in sync_res.json()["detail"]
