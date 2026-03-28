from datetime import datetime, timedelta

def test_create_auction(client):
    deadline = (datetime.utcnow() + timedelta(days=1)).isoformat()
    auction_data = {
        "title": "Test Item",
        "description": "Awesome test item",
        "lot_type": "product",
        "starting_price": 1.0,
        "deadline": deadline
    }
    response = client.post("/api/auctions/", json=auction_data)
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "Test Item"
    assert data["current_price"] == 1.0
    assert data["status"] == "active"

def test_get_auctions(client):
    # First create one
    deadline = (datetime.utcnow() + timedelta(days=1)).isoformat()
    client.post("/api/auctions/", json={
        "title": "Item 1",
        "starting_price": 10.0,
        "deadline": deadline
    })
    
    response = client.get("/api/auctions/")
    assert response.status_code == 200
    assert len(response.json()) >= 1

def test_place_bid(client, mocker):
    # Mock signature verification
    mocker.patch("app.services.auth.verify_solana_signature", return_value=True)
    
    # Create auction
    deadline = (datetime.utcnow() + timedelta(days=1)).isoformat()
    create_res = client.post("/api/auctions/", json={
        "title": "Bid Item",
        "starting_price": 5.0,
        "deadline": deadline
    })
    auction_id = create_res.json()["id"]
    
    # Place bid
    bid_res = client.post(f"/api/auctions/{auction_id}/bids", json={
        "amount": 6.0,
        "signature": "test-sig",
        "auction_id": auction_id
    })
    assert bid_res.status_code == 200
    assert bid_res.json()["amount"] == 6.0
    
    # Check auction price updated
    get_res = client.get(f"/api/auctions/{auction_id}")
    assert get_res.json()["current_price"] == 6.0

def test_bid_too_low(client):
    deadline = (datetime.utcnow() + timedelta(days=1)).isoformat()
    create_res = client.post("/api/auctions/", json={
        "title": "Low Bid Item",
        "starting_price": 10.0,
        "deadline": deadline
    })
    auction_id = create_res.json()["id"]
    
    bid_res = client.post(f"/api/auctions/{auction_id}/bids", json={
        "amount": 5.0,
        "signature": "test-sig",
        "auction_id": auction_id
    })
    assert bid_res.status_code == 400
    assert "greater than current price" in bid_res.json()["detail"]
