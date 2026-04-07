"""Tests for auction query endpoints (GET)."""

from datetime import datetime, timedelta

from app.models.models import Auction, AuctionStatus
from tests.conftest import _set_client_user


def _add_auction(db, owner_id, title="Test", status=AuctionStatus.ACTIVE, chain_status="created"):
    a = Auction(
        title=title,
        lot_type="physical_item",
        starting_price=1.0,
        current_price=1.0,
        deadline=datetime.utcnow() + timedelta(hours=6),
        owner_id=owner_id,
        status=status,
        chain_status=chain_status,
    )
    db.add(a)
    db.flush()
    db.refresh(a)
    return a


def test_list_auctions_empty(client):
    res = client.get("/api/auctions/")
    assert res.status_code == 200
    assert res.json() == []


def test_list_auctions_returns_active(client, db, test_user):
    _add_auction(db, test_user.id, title="Active1")
    _add_auction(db, test_user.id, title="Active2")

    res = client.get("/api/auctions/")
    assert res.status_code == 200
    titles = [a["title"] for a in res.json()]
    assert "Active1" in titles
    assert "Active2" in titles


def test_list_auctions_excludes_cancelled(client, db, test_user):
    _add_auction(db, test_user.id, title="Active")
    _add_auction(db, test_user.id, title="Gone", chain_status="cancelled")

    res = client.get("/api/auctions/")
    titles = [a["title"] for a in res.json()]
    assert "Active" in titles
    assert "Gone" not in titles


def test_list_auctions_excludes_settled(client, db, test_user):
    _add_auction(db, test_user.id, title="Live")
    _add_auction(db, test_user.id, title="Done", chain_status="settled")

    res = client.get("/api/auctions/")
    titles = [a["title"] for a in res.json()]
    assert "Live" in titles
    assert "Done" not in titles


def test_list_auctions_pagination(client, db, test_user):
    for i in range(15):
        _add_auction(db, test_user.id, title=f"Auction {i}")

    res = client.get("/api/auctions/?skip=0&limit=5")
    assert len(res.json()) == 5

    res2 = client.get("/api/auctions/?skip=10&limit=10")
    assert len(res2.json()) == 5


def test_get_auction_detail(client, db, test_user):
    a = _add_auction(db, test_user.id, title="Detail")

    res = client.get(f"/api/auctions/{a.id}")
    assert res.status_code == 200
    assert res.json()["title"] == "Detail"


def test_get_auction_not_found(client):
    res = client.get("/api/auctions/99999")
    assert res.status_code == 404


def test_get_my_auctions(client, db, test_user, seller_user):
    _add_auction(db, test_user.id, title="Mine")
    _add_auction(db, seller_user.id, title="Not mine")

    res = client.get("/api/auctions/my/auctions")
    assert res.status_code == 200
    titles = [a["title"] for a in res.json()]
    assert "Mine" in titles
    assert "Not mine" not in titles


def test_hidden_content_not_visible_to_others(client, db, test_user, seller_user):
    a = _add_auction(db, seller_user.id, title="Secret")
    a.hidden_content = "super secret"
    db.flush()

    # test_user views seller's auction
    res = client.get(f"/api/auctions/{a.id}")
    assert res.status_code == 200
    assert res.json().get("hidden_content") is None


def test_hidden_content_visible_to_owner(client, db, seller_user):
    _set_client_user(client, seller_user)
    a = _add_auction(db, seller_user.id, title="Owner Secret")
    a.hidden_content = "owner can see"
    db.flush()

    res = client.get(f"/api/auctions/{a.id}")
    assert res.status_code == 200
    assert res.json().get("hidden_content") == "owner can see"
