from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional, List
from ..models.models import LotType, AuctionStatus, EscrowStatus

# User Schemas
class UserBase(BaseModel):
    wallet_address: str
    username: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None

class UserUpdate(BaseModel):
    username: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None

class User(UserBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    balance: float
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

# Escrow Schemas
class Escrow(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    amount: float
    status: EscrowStatus
    tx_signature: str
    created_at: datetime

# Auction Schemas
class AuctionBase(BaseModel):
    title: str
    description: Optional[str] = None
    lot_type: LotType = LotType.PHYSICAL_ITEM
    starting_price: float
    deadline: datetime

class AuctionCreate(AuctionBase):
    hidden_content: Optional[str] = None # Secret link/info for 'information' lot type

class AuctionUpdate(BaseModel):
    status: Optional[AuctionStatus] = None
    tx_signature: Optional[str] = None

class Auction(AuctionBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    current_price: float
    status: AuctionStatus
    owner_id: int
    winner_id: Optional[int] = None
    created_at: datetime
    # hidden_content is EXCLUDED here to keep it secret
    
class AuctionDetail(Auction):
    bids: List[Bid] = []
    escrow: Optional[Escrow] = None
    hidden_content: Optional[str] = None # Only populated for winner/owner

# Finance Schemas
class WithdrawRequest(BaseModel):
    amount: float
    # In a real app, we'd verify a signature for the withdrawal too
    signature: str 

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
