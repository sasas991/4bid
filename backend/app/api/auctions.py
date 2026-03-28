from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from ..core.database import get_db
from ..core import security
from ..models.models import Auction, User, Bid, AuctionStatus
from ..schemas import schemas
from ..services import auctions as auction_service

router = APIRouter(prefix="/auctions", tags=["auctions"])

@router.get("/", response_model=List[schemas.Auction])
def get_auctions(skip: int = 0, limit: int = 10, db: Session = Depends(get_db)):
    return auction_service.get_active_auctions(db, skip, limit)

@router.post("/", response_model=schemas.Auction)
def create_auction(
    auction: schemas.AuctionCreate,
    current_user: User = Depends(security.get_current_user),
    db: Session = Depends(get_db)
):
    return auction_service.create_auction(db, auction, current_user.id)

@router.get("/my/auctions", response_model=List[schemas.Auction])
def get_my_auctions(
    current_user: User = Depends(security.get_current_user),
    db: Session = Depends(get_db)
):
    return db.query(Auction).filter(Auction.owner_id == current_user.id).all()

@router.get("/my/bids", response_model=List[schemas.Bid])
def get_my_bids(
    current_user: User = Depends(security.get_current_user),
    db: Session = Depends(get_db)
):
    return db.query(Bid).filter(Bid.user_id == current_user.id).all()

@router.get("/{auction_id}", response_model=schemas.AuctionDetail)
def get_auction(
    auction_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(security.get_optional_current_user),
):
    user_id = current_user.id if current_user else 0
    auction = auction_service.get_auction_detail(db, auction_id, user_id)

    visible_hidden: Optional[str] = auction.hidden_content
    if auction.winner_id != user_id and auction.owner_id != user_id:
        visible_hidden = None
    elif auction.status not in [
        AuctionStatus.PAID,
        AuctionStatus.SHIPPED,
        AuctionStatus.COMPLETED,
    ]:
        if auction.owner_id != user_id:
            visible_hidden = None

    detail = schemas.AuctionDetail.model_validate(auction, from_attributes=True)
    return detail.model_copy(update={"hidden_content": visible_hidden})

@router.post("/{auction_id}/bids", response_model=schemas.Bid)
def create_bid(
    auction_id: int,
    bid: schemas.BidCreate,
    current_user: User = Depends(security.get_current_user),
    db: Session = Depends(get_db)
):
    return auction_service.place_bid(db, auction_id, bid, current_user)

@router.patch("/{auction_id}/status", response_model=schemas.Auction)
def update_auction_status(
    auction_id: int,
    update: schemas.AuctionUpdate,
    current_user: User = Depends(security.get_current_user),
    db: Session = Depends(get_db)
):
    if not update.status:
        raise HTTPException(status_code=400, detail="Status must be provided")
    return auction_service.update_auction_status(db, auction_id, update.status, current_user.id, update.tx_signature)
