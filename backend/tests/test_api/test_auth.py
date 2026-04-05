import httpx
import pytest


def test_dev_login_disabled_by_default(client):
    response = client.post("/api/auth/dev-login")
    assert response.status_code == 404


def test_dev_login_returns_token_when_enabled(client, monkeypatch):
    import app.api.auth as auth_module
    monkeypatch.setattr(auth_module.settings, "DEV_AUTH_BYPASS", True)

    response = client.post("/api/auth/dev-login")
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


def test_dev_login_idempotent(client, monkeypatch):
    """Calling dev-login twice returns a token both times (same dev user reused)."""
    import app.api.auth as auth_module
    monkeypatch.setattr(auth_module.settings, "DEV_AUTH_BYPASS", True)

    r1 = client.post("/api/auth/dev-login")
    r2 = client.post("/api/auth/dev-login")
    assert r1.status_code == 200
    assert r2.status_code == 200


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


def test_google_login_verification_failure(client, mocker):
    request_error = httpx.RequestError("boom", request=httpx.Request("GET", "https://example.com"))
    mocker.patch("app.api.auth.verify_google_token", side_effect=request_error)

    response = client.post("/api/auth/google", json={"token": "bad-token"})

    assert response.status_code == 502
    assert response.json()["detail"] == "Unable to verify Google token right now"
