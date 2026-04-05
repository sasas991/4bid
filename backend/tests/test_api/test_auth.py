def test_get_nonce(client):
    wallet_address = "TestWallet1234567890"
    response = client.get(f"/api/auth/nonce/{wallet_address}")
    assert response.status_code == 200
    assert "nonce" in response.json()

def test_login_success(client, mocker):
    # Mock signature verification
    mocker.patch("app.services.auth.verify_solana_signature", return_value=True)
    
    wallet_address = "TestWallet1234567890"
    # Get nonce first
    nonce_res = client.get(f"/api/auth/nonce/{wallet_address}")
    nonce = nonce_res.json()["nonce"]
    
    # Login
    login_data = {
        "wallet_address": wallet_address,
        "signature": "valid-sig",
        "nonce": nonce
    }
    response = client.post("/api/auth/login", json=login_data)
    assert response.status_code == 200
    assert "access_token" in response.json()

def test_login_invalid_signature(client, mocker):
    # Mock signature verification as False
    mocker.patch("app.services.auth.verify_solana_signature", return_value=False)
    
    wallet_address = "TestWallet1234567890"
    nonce_res = client.get(f"/api/auth/nonce/{wallet_address}")
    nonce = nonce_res.json()["nonce"]
    
    login_data = {
        "wallet_address": wallet_address,
        "signature": "invalid-sig",
        "nonce": nonce
    }
    response = client.post("/api/auth/login", json=login_data)
    assert response.status_code == 400
    assert "Invalid signature" in response.json()["detail"]

def test_me_endpoint(client, test_user):
    response = client.get("/api/auth/me")
    assert response.status_code == 200
    assert response.json()["wallet_address"] == test_user.wallet_address
