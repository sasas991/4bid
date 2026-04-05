from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Enum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from ..core.database import Base

class LotType(str, enum.Enum):
    PHYSICAL_ITEM = "physical_item"
    INFORMATION = "information"
    PHYSICAL_SERVICE = "physical_service"
    DIGITAL_SERVICE = "digital_service"

class AuctionStatus(str, enum.Enum):
    ACTIVE = "active"
    FINISHED = "finished"  # Ended, waiting for payment
    PAID = "paid"          # Money in Escrow
    SHIPPED = "shipped"    # Item/Service sent
    COMPLETED = "completed" # Released from Escrow to Seller
    CANCELLED = "cancelled"

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    wallet_address = Column(String, unique=True, index=True, nullable=True)
    email = Column(String, unique=True, index=True, nullable=True)
    google_id = Column(String, unique=True, index=True, nullable=True)
    username = Column(String, nullable=True)
    bio = Column(Text, nullable=True)
    avatar_url = Column(String, nullable=True)
    nonce = Column(String, nullable=True)
    
    # Internal balance for withdrawals (earnings from auctions)
    balance = Column(Float, default=0.0)
    
    created_at = Column(DateTime, default=datetime.utcnow)

    auctions = relationship("Auction", back_populates="owner", foreign_keys="[Auction.owner_id]")
    bids = relationship("Bid", back_populates="user")

class Auction(Base):
    __tablename__ = "auctions"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True, nullable=False)
    description = Column(Text, nullable=True)
    lot_type = Column(Enum(LotType, values_callable=lambda e: [x.value for x in e]), default=LotType.PHYSICAL_ITEM)
    
    image_url = Column(String, nullable=True)

    # For 'information' type: content only visible to winner after payment
    hidden_content = Column(Text, nullable=True)
    
    starting_price = Column(Float, nullable=False)
    current_price = Column(Float, nullable=False)
    deadline = Column(DateTime, nullable=False)
    status = Column(Enum(AuctionStatus, values_callable=lambda e: [x.value for x in e]), default=AuctionStatus.ACTIVE)
    
    owner_id = Column(Integer, ForeignKey("users.id"))
    winner_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    # On-chain mirror fields (DB is projection, not authority)
    auction_pubkey = Column(String, unique=True, index=True, nullable=True)
    asset_pubkey = Column(String, index=True, nullable=True)
    mint_pubkey = Column(String, index=True, nullable=True)
    seller_pubkey = Column(String, index=True, nullable=True)
    winner_pubkey = Column(String, index=True, nullable=True)
    chain_status = Column(String, index=True, default="pending_create")
    finalize_signature = Column(String, nullable=True)
    settlement_signature = Column(String, nullable=True)
    cancel_signature = Column(String, nullable=True)
    last_synced_slot = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    owner = relationship("User", foreign_keys=[owner_id], back_populates="auctions")
    winner = relationship("User", foreign_keys=[winner_id])
    bids = relationship("Bid", back_populates="auction")
    escrow = relationship("Escrow", back_populates="auction", uselist=False)

class Bid(Base):
    __tablename__ = "bids"

    id = Column(Integer, primary_key=True, index=True)
    amount = Column(Float, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)
    signature = Column(String, nullable=False)
    bid_commit_pubkey = Column(String, index=True, nullable=True)
    commit_signature = Column(String, nullable=True)
    reveal_signature = Column(String, nullable=True)
    revealed_amount = Column(Float, nullable=True)
    on_chain = Column(Integer, default=0)
    user_id = Column(Integer, ForeignKey("users.id"))
    auction_id = Column(Integer, ForeignKey("auctions.id"))

    user = relationship("User", back_populates="bids")
    auction = relationship("Auction", back_populates="bids")

class EscrowStatus(str, enum.Enum):
    HELD = "held"           # Funds received from buyer
    RELEASED = "released"   # Funds sent to seller balance
    REFUNDED = "refunded"   # Funds returned to buyer

class Escrow(Base):
    __tablename__ = "escrows"

    id = Column(Integer, primary_key=True, index=True)
    auction_id = Column(Integer, ForeignKey("auctions.id"), unique=True)
    amount = Column(Float, nullable=False)
    status = Column(Enum(EscrowStatus, values_callable=lambda e: [x.value for x in e]), default=EscrowStatus.HELD)
    
    tx_signature = Column(String, nullable=False) # The payment TX from buyer
    settlement_signature = Column(String, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    auction = relationship("Auction", back_populates="escrow")
