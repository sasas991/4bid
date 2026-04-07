import time

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.core.database import Base, get_db
from app.core.security import get_current_user, get_optional_current_user
from app.models.models import User
from app.services.anchor_client import (
    CreateOnChainResult,
    CommitBidOnChainResult,
    CancelAuctionOnChainResult,
    FinalizeAuctionOnChainResult,
    DecodedAuctionAccount,
    DecodedAssetAccount,
    TxVerificationResult,
    AUCTION_STATUS_COMMIT_PHASE,
    DEFAULT_PUBKEY,
)

SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db():
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    yield session
    session.close()
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def test_user(db):
    user = User(wallet_address="TestWallet1234567890", nonce="test-nonce", balance=10.0)
    db.add(user)
    db.flush()
    db.refresh(user)
    return user


@pytest.fixture(scope="function")
def seller_user(db):
    user = User(wallet_address="SellerWallet777", username="seller_pro", balance=10.0)
    db.add(user)
    db.flush()
    db.refresh(user)
    return user


@pytest.fixture(scope="function")
def poor_user(db):
    user = User(wallet_address="PoorWallet999", balance=0.001)
    db.add(user)
    db.flush()
    db.refresh(user)
    return user


@pytest.fixture(scope="function")
def client(db, test_user):
    def override_get_db():
        yield db

    def override_get_current_user():
        return test_user

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user
    app.dependency_overrides[get_optional_current_user] = lambda: test_user

    with TestClient(app) as c:
        yield c

    app.dependency_overrides = {}


def _set_client_user(client, user):
    from app.core.security import get_current_user, get_optional_current_user
    client.app.dependency_overrides[get_current_user] = lambda: user
    client.app.dependency_overrides[get_optional_current_user] = lambda: user


# ---- Mock chain results ----

MOCK_AUCTION_PUBKEY = "7v3fY4aJPQjvWm21U6jvV3vfgjmfX8o3Yf6xwSYhQ3jS"
MOCK_ASSET_PUBKEY = "2vPpAtp3LhQhEn8Mo7VNHQz1hYJmVzjM9u6bD1M3YQ4o"
MOCK_MINT_PUBKEY = "5kHNR5hV1Jx7LhV9Lg3fV8hLGrME6NwEi9e8bJ3fN6r9"
MOCK_SELLER_PUBKEY = "62rkSuoWJa7kb7dGg2Kc4PK1JZRAhoCoVeGZNbdc1gvj"
MOCK_BID_COMMIT_PUBKEY = "BidCommitPDA111111111111111111111111111111111"


def make_create_on_chain_result(**overrides):
    defaults = dict(
        auction_pubkey=MOCK_AUCTION_PUBKEY,
        asset_pubkey=MOCK_ASSET_PUBKEY,
        mint_pubkey=MOCK_MINT_PUBKEY,
        seller_pubkey=MOCK_SELLER_PUBKEY,
        slot=100,
    )
    defaults.update(overrides)
    return CreateOnChainResult(**defaults)


def make_commit_bid_result(**overrides):
    defaults = dict(
        signature="bid_sig_abc123",
        bid_commit_pubkey=MOCK_BID_COMMIT_PUBKEY,
        salt_hex="aa" * 32,
        slot=200,
    )
    defaults.update(overrides)
    return CommitBidOnChainResult(**defaults)


def make_decoded_auction(
    auction_pubkey=MOCK_AUCTION_PUBKEY,
    seller_pubkey=MOCK_SELLER_PUBKEY,
    status_code=AUCTION_STATUS_COMMIT_PHASE,
    start_ts=None,
    commit_end_ts=None,
    **overrides,
):
    now = int(time.time())
    defaults = dict(
        auction_pubkey=auction_pubkey,
        protocol_pubkey=DEFAULT_PUBKEY,
        asset_pubkey=MOCK_ASSET_PUBKEY,
        mint_pubkey=MOCK_MINT_PUBKEY,
        seller_pubkey=seller_pubkey,
        winner_pubkey=DEFAULT_PUBKEY,
        highest_bidder_pubkey=DEFAULT_PUBKEY,
        start_ts=start_ts or now - 60,
        commit_end_ts=commit_end_ts or now + 3600,
        reveal_end_ts=(commit_end_ts or now + 3600) + 60,
        min_bid_lamports=100_000,
        highest_revealed_bid_lamports=0,
        status_code=status_code,
        settled=False,
        slot=100,
    )
    defaults.update(overrides)
    return DecodedAuctionAccount(**defaults)
