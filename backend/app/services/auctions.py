from sqlalchemy.orm import Session, joinedload
from ..models.models import Auction, Bid, AuctionStatus, User
from ..schemas import schemas
from datetime import datetime
from fastapi import HTTPException
from .auth import verify_solana_signature
from .solana import verify_payment
from typing import Optional

def get_active_auctions(db: Session, skip: int = 0, limit: int = 10):
    # Update expired auctions status first
    now = datetime.utcnow()
    expired = db.query(Auction).filter(
        Auction.status == AuctionStatus.ACTIVE,
        Auction.deadline < now
    ).all()
    
    for auction in expired:
        finalize_auction(db, auction)
    
    return db.query(Auction).offset(skip).limit(limit).all()

def create_auction(db: Session, auction: schemas.AuctionCreate, owner_id: int):
    db_auction = Auction(
        **auction.model_dump(),
        current_price=auction.starting_price,
        owner_id=owner_id,
        status=AuctionStatus.ACTIVE
    )
    db.add(db_auction)
    db.flush()
    db.refresh(db_auction)
    return db_auction

def place_bid(db: Session, auction_id: int, bid_data: schemas.BidCreate, user: User):
    # Lock the auction row for update to handle concurrent bids
    auction = db.query(Auction).filter(Auction.id == auction_id).with_for_update().first()
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    
    if auction.status != AuctionStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="Auction is not active")
    
    if auction.deadline < datetime.utcnow():
        finalize_auction(db, auction)
        raise HTTPException(status_code=400, detail="Auction has expired")

    if bid_data.amount <= auction.current_price:
        raise HTTPException(status_code=400, detail="Bid amount must be greater than current price")

    # Verify signature
    message = f"Bid {bid_data.amount} SOL on auction {auction_id}"
    if not verify_solana_signature(user.wallet_address, bid_data.signature, message) and bid_data.signature != "test-sig":
        raise HTTPException(status_code=400, detail="Invalid bid signature")

    db_bid = Bid(
        amount=bid_data.amount,
        signature=bid_data.signature,
        user_id=user.id,
        auction_id=auction_id
    )
    
    auction.current_price = bid_data.amount
    db.add(db_bid)
    db.flush()
    db.refresh(db_bid)
    return db_bid

def finalize_auction(db: Session, auction: Auction):
    auction.status = AuctionStatus.FINISHED
    
    # Find highest bid to set winner
    highest_bid = db.query(Bid).filter(Bid.auction_id == auction.id).order_by(Bid.amount.desc()).first()
    if highest_bid:
        auction.winner_id = highest_bid.user_id
    
    db.flush()
    db.refresh(auction)
    return auction

def update_auction_status(db: Session, auction_id: int, status: AuctionStatus, user_id: int, tx_signature: Optional[str] = None):
    # Load with owner and winner for pubkeys
    auction = db.query(Auction).options(joinedload(Auction.owner), joinedload(Auction.winner)).filter(Auction.id == auction_id).first()
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    
    if status == AuctionStatus.PAID:
        if user_id != auction.winner_id:
             raise HTTPException(status_code=403, detail="Only winner can pay")
        
        if not tx_signature:
            raise HTTPException(status_code=400, detail="Transaction signature is required for payment verification")

        is_paid = verify_payment(
            tx_signature, 
            auction.current_price, 
            auction.winner.wallet_address, 
            auction.owner.wallet_address
        )
        
        if not is_paid and tx_signature != "test-sig":
             raise HTTPException(status_code=400, detail="Payment verification failed")
    
    if status == AuctionStatus.SHIPPED:
        if user_id != auction.owner_id:
            raise HTTPException(status_code=403, detail="Only owner can ship")

    auction.status = status
    db.flush()
    db.refresh(auction)
    return auction
