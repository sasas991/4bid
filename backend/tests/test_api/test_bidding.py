"""Tests for bidding (POST /api/auctions/{id}/bids)."""

import time
from datetime import datetime, timedelta

from app.models.models import Auction, AuctionStatus
from tests.conftest import (
    _set_client_user,
    make_create_on_chain_result,
    make_commit_bid_result,
    make_decoded_auction,
    MOCK_AUCTION_PUBKEY,
)


def _create_auction_in_db(db, owner_id, starting_price=0.01, auction_pubkey=MOCK_AUCTION_PUBKEY):
    auction = Auction(
        title="Bid Test Auction",
        lot_type="physical_item",
        starting_price=starting_price,
        current_price=starting_price,
        deadline=datetime.utcnow() + timedelta(hours=6),
        owner_id=owner_id,
        status=AuctionStatus.ACTIVE,
        chain_status="created",
        auction_pubkey=auction_pubkey,
        asset_pubkey="asset123",
        mint_pubkey="mint123",
        seller_pubkey="seller123",
    )
    db.add(auction)
    db.flush()
    db.refresh(auction)
    return auction


def _mock_bid_chain(monkeypatch):
    from app.services import auctions as svc
    monkeypatch.setattr(
        svc.anchor_chain_client, "get_decoded_auction",
        lambda pubkey: make_decoded_auction(auction_pubkey=pubkey),
    )
    monkeypatch.setattr(
        svc.anchor_chain_client, "get_block_time",
        lambda: int(time.time()),
    )
    monkeypatch.setattr(
        svc.anchor_chain_client, "commit_bid_on_chain",
        lambda **kw: make_commit_bid_result(),
    )


# ---- Happy path ----


def test_place_bid_success(client, db, monkeypatch, test_user, seller_user):
    _set_client_user(client, seller_user)
    auction = _create_auction_in_db(db, owner_id=test_user.id)

    _mock_bid_chain(monkeypatch)

    res = client.post(f"/api/auctions/{auction.id}/bids", json={
        "amount": 0.05,
        "signature": "x",
        "auction_id": auction.id,
    })
    assert res.status_code == 200
    data = res.json()
    assert data["amount"] == 0.05
    assert data["on_chain"] == 1


def test_place_bid_deducts_balance(client, db, monkeypatch, test_user, seller_user):
    _set_client_user(client, seller_user)
    auction = _create_auction_in_db(db, owner_id=test_user.id)
    _mock_bid_chain(monkeypatch)

    balance_before = seller_user.balance
    client.post(f"/api/auctions/{auction.id}/bids", json={
        "amount": 1.0,
        "signature": "x",
        "auction_id": auction.id,
    })
    db.refresh(seller_user)
    assert seller_user.balance == balance_before - 1.0


def test_place_bid_updates_current_price(client, db, monkeypatch, test_user, seller_user):
    _set_client_user(client, seller_user)
    auction = _create_auction_in_db(db, owner_id=test_user.id, starting_price=0.01)
    _mock_bid_chain(monkeypatch)

    client.post(f"/api/auctions/{auction.id}/bids", json={
        "amount": 0.5,
        "signature": "x",
        "auction_id": auction.id,
    })
    db.refresh(auction)
    assert auction.current_price == 0.5


# ---- Validation errors ----


def test_bid_on_own_auction(client, db, monkeypatch, test_user):
    auction = _create_auction_in_db(db, owner_id=test_user.id)
    _mock_bid_chain(monkeypatch)

    res = client.post(f"/api/auctions/{auction.id}/bids", json={
        "amount": 0.1,
        "signature": "x",
        "auction_id": auction.id,
    })
    assert res.status_code == 400
    assert "Cannot bid on your own auction" in res.json()["detail"]


def test_bid_below_starting_price(client, db, monkeypatch, test_user, seller_user):
    _set_client_user(client, seller_user)
    auction = _create_auction_in_db(db, owner_id=test_user.id, starting_price=1.0)
    _mock_bid_chain(monkeypatch)

    res = client.post(f"/api/auctions/{auction.id}/bids", json={
        "amount": 0.5,
        "signature": "x",
        "auction_id": auction.id,
    })
    assert res.status_code == 400
    assert "at least" in res.json()["detail"]


def test_bid_insufficient_balance(client, db, monkeypatch, test_user, poor_user):
    _set_client_user(client, poor_user)
    auction = _create_auction_in_db(db, owner_id=test_user.id, starting_price=0.001)
    _mock_bid_chain(monkeypatch)

    res = client.post(f"/api/auctions/{auction.id}/bids", json={
        "amount": 1.0,
        "signature": "x",
        "auction_id": auction.id,
    })
    assert res.status_code == 400
    assert "Insufficient balance" in res.json()["detail"]


def test_bid_on_nonexistent_auction(client, monkeypatch):
    _mock_bid_chain(monkeypatch)

    res = client.post("/api/auctions/99999/bids", json={
        "amount": 0.1,
        "signature": "x",
        "auction_id": 99999,
    })
    assert res.status_code == 404


def test_bid_on_cancelled_auction(client, db, monkeypatch, test_user, seller_user):
    _set_client_user(client, seller_user)
    auction = _create_auction_in_db(db, owner_id=test_user.id)
    auction.status = AuctionStatus.CANCELLED
    db.flush()
    _mock_bid_chain(monkeypatch)

    res = client.post(f"/api/auctions/{auction.id}/bids", json={
        "amount": 0.1,
        "signature": "x",
        "auction_id": auction.id,
    })
    assert res.status_code == 400
    assert "not active" in res.json()["detail"]


def test_bid_without_chain_pubkey(client, db, monkeypatch, test_user, seller_user):
    _set_client_user(client, seller_user)
    auction = _create_auction_in_db(db, owner_id=test_user.id, auction_pubkey=None)
    _mock_bid_chain(monkeypatch)

    res = client.post(f"/api/auctions/{auction.id}/bids", json={
        "amount": 0.1,
        "signature": "x",
        "auction_id": auction.id,
    })
    assert res.status_code == 400
    assert "not synced" in res.json()["detail"]


def test_bid_chain_commit_failure(client, db, monkeypatch, test_user, seller_user):
    _set_client_user(client, seller_user)
    auction = _create_auction_in_db(db, owner_id=test_user.id)
    from app.services import auctions as svc

    monkeypatch.setattr(
        svc.anchor_chain_client, "get_decoded_auction",
        lambda pubkey: make_decoded_auction(auction_pubkey=pubkey),
    )
    monkeypatch.setattr(
        svc.anchor_chain_client, "get_block_time",
        lambda: int(time.time()),
    )
    monkeypatch.setattr(
        svc.anchor_chain_client, "commit_bid_on_chain",
        lambda **kw: (_ for _ in ()).throw(ValueError("RPC error")),
    )

    res = client.post(f"/api/auctions/{auction.id}/bids", json={
        "amount": 0.1,
        "signature": "x",
        "auction_id": auction.id,
    })
    assert res.status_code == 502
    assert "RPC error" in res.json()["detail"]


def test_bid_no_balance_deducted_on_chain_failure(client, db, monkeypatch, test_user, seller_user):
    _set_client_user(client, seller_user)
    auction = _create_auction_in_db(db, owner_id=test_user.id)
    from app.services import auctions as svc

    monkeypatch.setattr(
        svc.anchor_chain_client, "get_decoded_auction",
        lambda pubkey: make_decoded_auction(auction_pubkey=pubkey),
    )
    monkeypatch.setattr(
        svc.anchor_chain_client, "get_block_time",
        lambda: int(time.time()),
    )
    monkeypatch.setattr(
        svc.anchor_chain_client, "commit_bid_on_chain",
        lambda **kw: (_ for _ in ()).throw(ValueError("fail")),
    )

    balance_before = seller_user.balance
    client.post(f"/api/auctions/{auction.id}/bids", json={
        "amount": 0.1,
        "signature": "x",
        "auction_id": auction.id,
    })
    db.refresh(seller_user)
    # Balance should NOT be deducted when chain call fails (tx rolls back)
    assert seller_user.balance == balance_before


def test_bid_auction_not_on_chain(client, db, monkeypatch, test_user, seller_user):
    _set_client_user(client, seller_user)
    auction = _create_auction_in_db(db, owner_id=test_user.id)
    from app.services import auctions as svc

    monkeypatch.setattr(
        svc.anchor_chain_client, "get_decoded_auction",
        lambda pubkey: (_ for _ in ()).throw(ValueError("Account not found")),
    )

    res = client.post(f"/api/auctions/{auction.id}/bids", json={
        "amount": 0.1,
        "signature": "x",
        "auction_id": auction.id,
    })
    assert res.status_code == 400
    assert "does not exist on-chain" in res.json()["detail"]
