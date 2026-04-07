"""Tests for cancel (POST /api/auctions/{id}/cancel) and finalize (POST /api/auctions/{id}/finalize)."""

from datetime import datetime, timedelta

from app.models.models import Auction, AuctionStatus
from app.services.anchor_client import CancelAuctionOnChainResult, FinalizeAuctionOnChainResult
from tests.conftest import _set_client_user, MOCK_AUCTION_PUBKEY


def _auction_in_db(db, owner_id, **overrides):
    defaults = dict(
        title="Cancel Test",
        lot_type="physical_item",
        starting_price=0.1,
        current_price=0.1,
        deadline=datetime.utcnow() + timedelta(hours=6),
        owner_id=owner_id,
        status=AuctionStatus.ACTIVE,
        chain_status="created",
        auction_pubkey=MOCK_AUCTION_PUBKEY,
        asset_pubkey="asset1",
        mint_pubkey="mint1",
        seller_pubkey="seller1",
    )
    defaults.update(overrides)
    auction = Auction(**defaults)
    db.add(auction)
    db.flush()
    db.refresh(auction)
    return auction


# ====================
#  CANCEL AUCTION
# ====================


def test_cancel_auction_success(client, db, monkeypatch, seller_user):
    _set_client_user(client, seller_user)
    auction = _auction_in_db(db, owner_id=seller_user.id)

    from app.services import auctions as svc
    monkeypatch.setattr(
        svc.anchor_chain_client, "cancel_auction_on_chain",
        lambda **kw: CancelAuctionOnChainResult(signature="cancel_sig", slot=300),
    )

    res = client.post(f"/api/auctions/{auction.id}/cancel")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "cancelled"
    assert data["chain_status"] == "cancelled"


def test_cancel_auction_updates_db(client, db, monkeypatch, seller_user):
    _set_client_user(client, seller_user)
    auction = _auction_in_db(db, owner_id=seller_user.id)

    from app.services import auctions as svc
    monkeypatch.setattr(
        svc.anchor_chain_client, "cancel_auction_on_chain",
        lambda **kw: CancelAuctionOnChainResult(signature="sig_abc", slot=301),
    )

    client.post(f"/api/auctions/{auction.id}/cancel")
    db.refresh(auction)
    assert auction.status == AuctionStatus.CANCELLED
    assert auction.chain_status == "cancelled"
    assert auction.cancel_signature == "sig_abc"


def test_cancel_auction_not_owner(client, db, monkeypatch, test_user, seller_user):
    auction = _auction_in_db(db, owner_id=seller_user.id)
    # test_user (default) tries to cancel seller_user's auction

    from app.services import auctions as svc
    monkeypatch.setattr(
        svc.anchor_chain_client, "cancel_auction_on_chain",
        lambda **kw: CancelAuctionOnChainResult(signature="x", slot=1),
    )

    res = client.post(f"/api/auctions/{auction.id}/cancel")
    assert res.status_code == 403
    assert "owner" in res.json()["detail"].lower()


def test_cancel_already_cancelled(client, db, monkeypatch, seller_user):
    _set_client_user(client, seller_user)
    auction = _auction_in_db(db, owner_id=seller_user.id, status=AuctionStatus.CANCELLED)

    res = client.post(f"/api/auctions/{auction.id}/cancel")
    assert res.status_code == 400
    assert "already cancelled" in res.json()["detail"].lower()


def test_cancel_missing_chain_data(client, db, monkeypatch, seller_user):
    _set_client_user(client, seller_user)
    auction = _auction_in_db(db, owner_id=seller_user.id, auction_pubkey=None, asset_pubkey=None)

    res = client.post(f"/api/auctions/{auction.id}/cancel")
    assert res.status_code == 400
    assert "missing" in res.json()["detail"].lower()


def test_cancel_chain_failure(client, db, monkeypatch, seller_user):
    _set_client_user(client, seller_user)
    auction = _auction_in_db(db, owner_id=seller_user.id)

    from app.services import auctions as svc
    monkeypatch.setattr(
        svc.anchor_chain_client, "cancel_auction_on_chain",
        lambda **kw: (_ for _ in ()).throw(ValueError("chain down")),
    )

    res = client.post(f"/api/auctions/{auction.id}/cancel")
    assert res.status_code == 502
    assert "chain down" in res.json()["detail"]


def test_cancel_nonexistent_auction(client):
    res = client.post("/api/auctions/99999/cancel")
    assert res.status_code == 404


# ====================
#  FINALIZE AUCTION
# ====================


def test_finalize_auction_success(client, db, monkeypatch, seller_user):
    _set_client_user(client, seller_user)
    auction = _auction_in_db(db, owner_id=seller_user.id)

    from app.services import auctions as svc
    monkeypatch.setattr(
        svc.anchor_chain_client, "finalize_auction_on_chain",
        lambda **kw: FinalizeAuctionOnChainResult(signature="finalize_sig", slot=400),
    )

    res = client.post(f"/api/auctions/{auction.id}/finalize")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "finished"
    assert data["chain_status"] == "finalized"


def test_finalize_not_owner(client, db, monkeypatch, test_user, seller_user):
    auction = _auction_in_db(db, owner_id=seller_user.id)

    res = client.post(f"/api/auctions/{auction.id}/finalize")
    assert res.status_code == 403


def test_finalize_chain_failure(client, db, monkeypatch, seller_user):
    _set_client_user(client, seller_user)
    auction = _auction_in_db(db, owner_id=seller_user.id)

    from app.services import auctions as svc
    monkeypatch.setattr(
        svc.anchor_chain_client, "finalize_auction_on_chain",
        lambda **kw: (_ for _ in ()).throw(ValueError("timeout")),
    )

    res = client.post(f"/api/auctions/{auction.id}/finalize")
    assert res.status_code == 502


def test_finalize_missing_chain_data(client, db, monkeypatch, seller_user):
    _set_client_user(client, seller_user)
    auction = _auction_in_db(db, owner_id=seller_user.id, auction_pubkey=None, seller_pubkey=None)

    res = client.post(f"/api/auctions/{auction.id}/finalize")
    assert res.status_code == 400
    assert "missing" in res.json()["detail"].lower()
