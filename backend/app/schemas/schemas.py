from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional, List
from ..models.models import LotType, AuctionStatus

# User Schemas
class UserBase(BaseModel):
    wallet_address: str

class UserCreate(UserBase):
    pass

class User(UserBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime

# Bid Schemas
class BidBase(BaseModel):
    amount: float
    auction_id: int

class BidCreate(BidBase):
    signature: str

class Bid(BidBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    timestamp: datetime
    user_id: int
    signature: str

# Auction Schemas
class AuctionBase(BaseModel):
    title: str
    description: Optional[str] = None
    lot_type: LotType = LotType.PRODUCT
    starting_price: float
    deadline: datetime

class AuctionCreate(AuctionBase):
    pass

class AuctionUpdate(BaseModel):
    status: Optional[AuctionStatus] = None
    winner_id: Optional[int] = None
    tx_signature: Optional[str] = None

class Auction(AuctionBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    current_price: float
    status: AuctionStatus
    owner_id: int
    winner_id: Optional[int] = None
    created_at: datetime
    bids: List[Bid] = []

# Auth Schemas
class NonceResponse(BaseModel):
    nonce: str

class LoginRequest(BaseModel):
    wallet_address: str
    signature: str
    nonce: str

class Token(BaseModel):
    access_token: str
    token_type: str
