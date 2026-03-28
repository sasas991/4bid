import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.main import app
from app.core.database import Base, get_db
from app.core.security import get_current_user, get_optional_current_user
from app.models.models import User

# SQLite test database
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
    user = User(wallet_address="TestWallet1234567890", nonce="test-nonce", balance=0.0)
    db.add(user)
    db.flush()
    db.refresh(user)
    return user

@pytest.fixture(scope="function")
def seller_user(db):
    user = User(wallet_address="SellerWallet777", username="seller_pro", balance=0.0)
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
