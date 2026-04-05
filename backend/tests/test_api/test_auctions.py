from datetime import datetime, timedelta


def _set_client_user(client, user):
    from app.core.security import get_current_user, get_optional_current_user

    client.app.dependency_overrides[get_current_user] = lambda: user
    client.app.dependency_overrides[get_optional_current_user] = lambda: user


def test_critical_write_paths_are_on_chain_only(client, seller_user):
    _set_client_user(client, seller_user)

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
    auction_id = created.json()["id"]

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


def test_chain_sync_updates_projection(client, db, test_user, seller_user):
    from app.models.models import Auction

    _set_client_user(client, seller_user)
    deadline = (datetime.utcnow() + timedelta(days=1)).isoformat()
    created = client.post(
        "/api/auctions/",
        json={
            "title": "Sync me",
            "description": "projection",
            "lot_type": "physical_item",
            "starting_price": 1.0,
            "deadline": deadline,
        },
    )
    assert created.status_code == 200
    auction_id = created.json()["id"]

    payload = {
        "auction_pubkey": "7v3fY4aJPQjvWm21U6jvV3vfgjmfX8o3Yf6xwSYhQ3jS",
        "asset_pubkey": "2vPpAtp3LhQhEn8Mo7VNHQz1hYJmVzjM9u6bD1M3YQ4o",
        "mint_pubkey": "5kHNR5hV1Jx7LhV9Lg3fV8hLGrME6NwEi9e8bJ3fN6r9",
        "seller_pubkey": seller_user.wallet_address,
        "winner_pubkey": test_user.wallet_address,
        "chain_status": "finalized",
        "current_price_lamports": 2_500_000_000,
        "finalize_signature": "finalize_sig",
        "settlement_signature": "settle_sig",
        "last_synced_slot": 123,
    }

    sync_res = client.post(f"/api/auctions/{auction_id}/chain/sync", json=payload)
    assert sync_res.status_code == 200

    db_auction = db.query(Auction).filter(Auction.id == auction_id).first()
    assert db_auction is not None
    assert db_auction.auction_pubkey == payload["auction_pubkey"]
    assert db_auction.chain_status == "finalized"
    assert db_auction.winner_id == test_user.id
    assert db_auction.current_price == 2.5
