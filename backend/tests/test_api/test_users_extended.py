"""Extended tests for user endpoints (deposit, withdraw, profile)."""

from tests.conftest import _set_client_user


# ====================
#  DEPOSIT
# ====================


def test_deposit_success(client, db, monkeypatch, test_user):
    from app.services import solana as sol_svc
    monkeypatch.setattr(
        sol_svc, "verify_deposit_transaction",
        lambda signature, expected_sender, expected_amount_sol: expected_amount_sol,
    )

    res = client.post("/api/users/deposit", json={
        "amount": 1.5,
        "signature": "valid_sig_123",
    })
    assert res.status_code == 200
    db.refresh(test_user)
    assert test_user.balance >= 1.5


def test_deposit_zero_amount(client):
    res = client.post("/api/users/deposit", json={
        "amount": 0,
        "signature": "sig",
    })
    assert res.status_code == 400


def test_deposit_negative_amount(client):
    res = client.post("/api/users/deposit", json={
        "amount": -1.0,
        "signature": "sig",
    })
    assert res.status_code == 400


def test_deposit_unverifiable_tx(client, monkeypatch):
    from app.services import solana as sol_svc
    monkeypatch.setattr(
        sol_svc, "verify_deposit_transaction",
        lambda signature, expected_sender, expected_amount_sol: None,
    )

    res = client.post("/api/users/deposit", json={
        "amount": 1.0,
        "signature": "bad_sig",
    })
    assert res.status_code == 400
    assert "verify" in res.json()["detail"].lower()


# ====================
#  WITHDRAW
# ====================


def test_withdraw_success(client, db, monkeypatch, test_user):
    from app.services import auth as auth_svc
    monkeypatch.setattr(
        auth_svc, "verify_solana_signature",
        lambda wallet, sig, msg: True,
    )

    test_user.balance = 5.0
    db.flush()

    res = client.post("/api/users/withdraw", json={
        "amount": 2.0,
        "signature": "valid_withdraw_sig",
    })
    assert res.status_code == 200
    db.refresh(test_user)
    assert test_user.balance == 3.0


def test_withdraw_insufficient_balance(client, db, monkeypatch, test_user):
    from app.services import auth as auth_svc
    monkeypatch.setattr(
        auth_svc, "verify_solana_signature",
        lambda wallet, sig, msg: True,
    )

    test_user.balance = 0.5
    db.flush()

    res = client.post("/api/users/withdraw", json={
        "amount": 1.0,
        "signature": "sig",
    })
    assert res.status_code == 400
    assert "insufficient" in res.json()["detail"].lower()


def test_withdraw_zero_amount(client):
    res = client.post("/api/users/withdraw", json={
        "amount": 0,
        "signature": "sig",
    })
    assert res.status_code == 400


def test_withdraw_no_wallet(client, db, test_user):
    test_user.wallet_address = None
    db.flush()

    res = client.post("/api/users/withdraw", json={
        "amount": 1.0,
        "signature": "sig",
    })
    assert res.status_code == 400


# ====================
#  PROFILE
# ====================


def test_get_profile(client, test_user):
    res = client.get("/api/users/me")
    assert res.status_code == 200
    data = res.json()
    assert data["wallet_address"] == test_user.wallet_address


def test_update_username(client, db, test_user):
    res = client.patch("/api/users/me", json={
        "username": "new_name",
    })
    assert res.status_code == 200
    db.refresh(test_user)
    assert test_user.username == "new_name"


def test_update_avatar_url(client, db, test_user):
    res = client.patch("/api/users/me", json={
        "avatar_url": "https://example.com/avatar.png",
    })
    assert res.status_code == 200
    db.refresh(test_user)
    assert test_user.avatar_url == "https://example.com/avatar.png"
