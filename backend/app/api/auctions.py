from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from ..db.session import get_db
from ..models.models import Auction, User, Bid, AuctionStatus
from ..schemas import schemas
from ..services import auth
from datetime import datetime

router = APIRouter(prefix="/auctions", tags=["auctions"])

@router.get("/", response_model=List[schemas.Auction])
def get_auctions(skip: int = 0, limit: int = 10, db: Session = Depends(get_db)):
    return db.query(Auction).offset(skip).limit(limit).all()

@router.post("/", response_model=schemas.Auction)
def create_auction(
    auction: schemas.AuctionCreate,
    current_user: User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    db_auction = Auction(
        **auction.model_dump(),
        current_price=auction.starting_price,
        owner_id=current_user.id
    )
    db.add(db_auction)
    db.commit()
    db.refresh(db_auction)
    return db_auction

@router.get("/{auction_id}", response_model=schemas.Auction)
def get_auction(auction_id: int, db: Session = Depends(get_db)):
    auction = db.query(Auction).filter(Auction.id == auction_id).first()
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    return auction

@router.post("/{auction_id}/bids", response_model=schemas.Bid)
def create_bid(
    auction_id: int,
    bid: schemas.BidCreate,
    current_user: User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    auction = db.query(Auction).filter(Auction.id == auction_id).first()
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    
    if auction.status != AuctionStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="Auction is not active")
    
    if auction.deadline < datetime.utcnow():
        auction.status = AuctionStatus.FINISHED
        db.commit()
        raise HTTPException(status_code=400, detail="Auction has expired")

    if bid.amount <= auction.current_price:
        raise HTTPException(status_code=400, detail="Bid amount must be greater than current price")

    # In a real app, verify Solana signature for the bid
    # message = f"Bid {bid.amount} on {auction_id}"
    # is_valid = auth.verify_solana_signature(current_user.wallet_address, bid.signature, message)
    # if not is_valid and bid.signature != "test-sig":
    #     raise HTTPException(status_code=400, detail="Invalid bid signature")

    db_bid = Bid(
        amount=bid.amount,
        signature=bid.signature,
        user_id=current_user.id,
        auction_id=auction_id
    )
    
    auction.current_price = bid.amount
    db.add(db_bid)
    db.commit()
    db.refresh(db_bid)
    return db_bid
