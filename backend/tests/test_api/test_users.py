def test_update_profile(client, test_user):
    response = client.patch("/api/users/me", json={
        "username": "new_name",
        "bio": "Expert trader",
        "avatar_url": "https://avatar.com/123"
    })
    assert response.status_code == 200
    data = response.json()
    assert data["username"] == "new_name"
    assert data["bio"] == "Expert trader"


def test_update_profile_clear_bio(client, test_user):
    response = client.patch("/api/users/me", json={"bio": ""})
    assert response.status_code == 200
    assert response.json()["bio"] == ""

def test_withdraw_funds_insufficient(client, test_user):
    # User balance is 0.0 initially
    response = client.post("/api/users/withdraw", json={
        "amount": 5.0,
        "signature": "withdraw-sig"
    })
    assert response.status_code == 400
    assert "Insufficient balance" in response.json()["detail"]

def test_withdraw_funds_success(client, db, test_user):
    # Set balance
    test_user.balance = 20.0
    db.commit()
    
    response = client.post("/api/users/withdraw", json={
        "amount": 5.0,
        "signature": "withdraw-sig"
    })
    assert response.status_code == 200
    assert response.json()["balance"] == 15.0
