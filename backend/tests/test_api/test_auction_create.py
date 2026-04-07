"""Tests for auction creation (POST /api/auctions/)."""

import time
from datetime import datetime, timedelta
from unittest.mock import patch

from tests.conftest import (
    _set_client_user,
    make_create_on_chain_result,
    MOCK_AUCTION_PUBKEY,
    MOCK_ASSET_PUBKEY,
    MOCK_MINT_PUBKEY,
    MOCK_SELLER_PUBKEY,
)


def _deadline(hours=6):
    return (datetime.utcnow() + timedelta(hours=hours)).isoformat()


def _mock_chain_success(monkeypatch):
    """Patch chain client so create_auction_on_chain succeeds."""
    from app.services import auctions as svc
    monkeypatch.setattr(
        svc.anchor_chain_client,
        "create_auction_on_chain",
        lambda **kw: make_create_on_chain_result(),
    )
    monkeypatch.setattr(
        svc.anchor_chain_client, "get_block_time", lambda: int(time.time())
    )


# ---- Happy path ----


def test_create_auction_success(client, monkeypatch, seller_user):
    _set_client_user(client, seller_user)
    _mock_chain_success(monkeypatch)

    res = client.post("/api/auctions/", json={
        "title": "Test Item",
        "lot_type": "physical_item",
        "starting_price": 0.5,
        "deadline": _deadline(),
    })
    assert res.status_code == 200
    data = res.json()
    assert data["title"] == "Test Item"
    assert data["auction_pubkey"] == MOCK_AUCTION_PUBKEY
    assert data["asset_pubkey"] == MOCK_ASSET_PUBKEY
    assert data["mint_pubkey"] == MOCK_MINT_PUBKEY
    assert data["seller_pubkey"] == MOCK_SELLER_PUBKEY
    assert data["chain_status"] == "created"
    assert data["current_price"] == 0.5


def test_create_auction_deducts_rent(client, db, monkeypatch, seller_user):
    _set_client_user(client, seller_user)
    _mock_chain_success(monkeypatch)
    balance_before = seller_user.balance

    res = client.post("/api/auctions/", json={
        "title": "Rent test",
        "lot_type": "information",
        "starting_price": 0.01,
        "deadline": _deadline(),
    })
    assert res.status_code == 200
    db.refresh(seller_user)
    assert seller_user.balance < balance_before


def test_create_auction_with_description_and_image(client, monkeypatch, seller_user):
    _set_client_user(client, seller_user)
    _mock_chain_success(monkeypatch)

    res = client.post("/api/auctions/", json={
        "title": "Fancy item",
        "description": "Very nice item",
        "lot_type": "digital_service",
        "starting_price": 1.0,
        "deadline": _deadline(),
        "image_url": "https://example.com/img.png",
    })
    assert res.status_code == 200
    assert res.json()["description"] == "Very nice item"


# ---- Validation errors ----


def test_create_auction_insufficient_balance(client, monkeypatch, poor_user):
    _set_client_user(client, poor_user)
    _mock_chain_success(monkeypatch)

    res = client.post("/api/auctions/", json={
        "title": "Too poor",
        "lot_type": "physical_item",
        "starting_price": 0.01,
        "deadline": _deadline(),
    })
    assert res.status_code == 400
    assert "Insufficient balance" in res.json()["detail"]


def test_create_auction_missing_title(client, monkeypatch, seller_user):
    _set_client_user(client, seller_user)
    _mock_chain_success(monkeypatch)

    res = client.post("/api/auctions/", json={
        "lot_type": "physical_item",
        "starting_price": 1.0,
        "deadline": _deadline(),
    })
    assert res.status_code == 422  # validation error


def test_create_auction_missing_deadline(client, monkeypatch, seller_user):
    _set_client_user(client, seller_user)
    _mock_chain_success(monkeypatch)

    res = client.post("/api/auctions/", json={
        "title": "No deadline",
        "lot_type": "physical_item",
        "starting_price": 1.0,
    })
    assert res.status_code == 422


# ---- Chain failure ----


def test_create_auction_chain_failure_returns_502(client, monkeypatch, seller_user):
    _set_client_user(client, seller_user)
    from app.services import auctions as svc

    monkeypatch.setattr(
        svc.anchor_chain_client, "get_block_time", lambda: int(time.time())
    )
    monkeypatch.setattr(
        svc.anchor_chain_client,
        "create_auction_on_chain",
        lambda **kw: (_ for _ in ()).throw(ValueError("RPC down")),
    )

    res = client.post("/api/auctions/", json={
        "title": "Chain fail",
        "lot_type": "physical_item",
        "starting_price": 0.1,
        "deadline": _deadline(),
    })
    assert res.status_code == 502
    assert "RPC down" in res.json()["detail"]


def test_create_auction_chain_failure_marks_chain_failed(client, db, monkeypatch, seller_user):
    _set_client_user(client, seller_user)
    from app.models.models import Auction
    from app.services import auctions as svc

    monkeypatch.setattr(
        svc.anchor_chain_client, "get_block_time", lambda: int(time.time())
    )
    monkeypatch.setattr(
        svc.anchor_chain_client,
        "create_auction_on_chain",
        lambda **kw: (_ for _ in ()).throw(ValueError("timeout")),
    )

    res = client.post("/api/auctions/", json={
        "title": "Will fail",
        "lot_type": "physical_item",
        "starting_price": 0.1,
        "deadline": _deadline(),
    })
    assert res.status_code == 502

    auction = db.query(Auction).filter(Auction.title == "Will fail").first()
    assert auction is not None
    assert auction.chain_status == "chain_failed"
