from datetime import datetime, timedelta
from app.models.models import AuctionStatus


def _set_client_user(client, user):
    from app.core.security import get_current_user, get_optional_current_user

    client.app.dependency_overrides[get_current_user] = lambda: user
    client.app.dependency_overrides[get_optional_current_user] = lambda: user


def test_full_escrow_lifecycle(client, db, test_user, seller_user, mocker):
    mocker.patch("app.services.auth.verify_solana_signature", return_value=True)
    mocker.patch("app.services.auctions.verify_solana_signature", return_value=True)
    mocker.patch("app.services.auctions.verify_payment", return_value=True)

    # 1. Seller creates auction for 'information'
    deadline = (datetime.utcnow() + timedelta(days=1)).isoformat()
    _set_client_user(client, seller_user)

    auction_res = client.post("/api/auctions/", json={
        "title": "Secret Strategy",
        "description": "Winning guide",
        "lot_type": "information",
        "hidden_content": "https://secret-link.com",
        "starting_price": 5.0,
        "deadline": deadline
    })
    auction_id = auction_res.json()["id"]

    # 2. Buyer places bid
    _set_client_user(client, test_user)
    bid_res = client.post(
        f"/api/auctions/{auction_id}/bids",
        json={
            "amount": 10.0,
            "signature": "bid-sig",
            "auction_id": auction_id,
        },
    )
    assert bid_res.status_code == 200

    # 3. Time passes (force finish)
    # In tests we can call status update or just check detail
    client.get(f"/api/auctions/{auction_id}") # Triggers finalize if expired (but here not expired)
    # Manually finish for the sake of the test flow
    from app.models.models import Auction
    db_auction = db.query(Auction).filter(Auction.id == auction_id).first()
    db_auction.status = AuctionStatus.FINISHED
    db_auction.winner_id = test_user.id
    db.commit()

    # 4. Buyer pays (status -> PAID, Escrow -> HELD)
    pay_res = client.patch(f"/api/auctions/{auction_id}/status", json={
        "status": "paid",
        "tx_signature": "solana-tx-signature"
    })
    assert pay_res.status_code == 200
    assert pay_res.json()["status"] == "paid"

    # 5. Buyer check detail and SEES hidden content
    detail_res = client.get(f"/api/auctions/{auction_id}")
    assert detail_res.json()["hidden_content"] == "https://secret-link.com"

    # 6. Buyer confirms completion (status -> COMPLETED, Escrow -> RELEASED, Seller balance UP)
    complete_res = client.patch(f"/api/auctions/{auction_id}/status", json={
        "status": "completed"
    })
    assert complete_res.status_code == 200
    
    # Check seller balance
    db.refresh(seller_user)
    assert seller_user.balance == 10.0


def test_get_auction_detail_anonymous_hides_hidden(client, seller_user):
    """GET without a viewer identity must not leak hidden_content to the DB or JSON."""
    from app.core.security import get_optional_current_user

    _set_client_user(client, seller_user)

    deadline = (datetime.utcnow() + timedelta(days=1)).isoformat()
    created = client.post(
        "/api/auctions/",
        json={
            "title": "Secret",
            "lot_type": "information",
            "hidden_content": "https://secret.example/hidden",
            "starting_price": 1.0,
            "deadline": deadline,
        },
    )
    assert created.status_code == 200
    auction_id = created.json()["id"]

    client.app.dependency_overrides[get_optional_current_user] = lambda: None
    detail = client.get(f"/api/auctions/{auction_id}")
    assert detail.status_code == 200
    assert detail.json()["hidden_content"] is None
