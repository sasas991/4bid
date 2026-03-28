from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Enum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from ..core.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    wallet_address = Column(String, unique=True, index=True, nullable=False)
    nonce = Column(String, nullable=True) # Used for wallet login
    created_at = Column(DateTime, default=datetime.utcnow)

    auctions = relationship("Auction", back_populates="owner", foreign_keys="[Auction.owner_id]")
    bids = relationship("Bid", back_populates="user")

class LotType(str, enum.Enum):
    PRODUCT = "product"
    SERVICE = "service"
    KNOWLEDGE = "knowledge"

class AuctionStatus(str, enum.Enum):
    ACTIVE = "active"
    FINISHED = "finished"
    PAID = "paid"
    SHIPPED = "shipped"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class Auction(Base):
    __tablename__ = "auctions"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True, nullable=False)
    description = Column(Text, nullable=True)
    lot_type = Column(Enum(LotType), default=LotType.PRODUCT)
    starting_price = Column(Float, nullable=False)
    current_price = Column(Float, nullable=False)
    deadline = Column(DateTime, nullable=False)
    status = Column(Enum(AuctionStatus), default=AuctionStatus.ACTIVE)
    owner_id = Column(Integer, ForeignKey("users.id"))
    winner_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    owner = relationship("User", foreign_keys=[owner_id], back_populates="auctions")
    winner = relationship("User", foreign_keys=[winner_id])
    bids = relationship("Bid", back_populates="auction")

class Bid(Base):
    __tablename__ = "bids"

    id = Column(Integer, primary_key=True, index=True)
    amount = Column(Float, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)
    signature = Column(String, nullable=False) # Solana signature for the bid
    user_id = Column(Integer, ForeignKey("users.id"))
    auction_id = Column(Integer, ForeignKey("auctions.id"))

    user = relationship("User", back_populates="bids")
    auction = relationship("Auction", back_populates="bids")
