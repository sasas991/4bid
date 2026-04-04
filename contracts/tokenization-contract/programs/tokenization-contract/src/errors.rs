use anchor_lang::prelude::*;

#[error_code]
pub enum AuctionError {
    #[msg("Protocol is paused")]
    ProtocolPaused,
    #[msg("Only admin can execute this instruction")]
    UnauthorizedAdmin,
    #[msg("Only seller can execute this instruction")]
    UnauthorizedSeller,
    #[msg("Invalid fee bps")]
    InvalidFeeBps,
    #[msg("Invalid timestamp window")]
    InvalidTimeWindow,
    #[msg("Invalid auction phase")]
    InvalidPhase,
    #[msg("Auction already finalized")]
    AuctionAlreadyFinalized,
    #[msg("Auction already cancelled")]
    AuctionAlreadyCancelled,
    #[msg("Auction is not finalizable yet")]
    NotFinalizableYet,
    #[msg("Bid is below minimum")]
    BidTooLow,
    #[msg("Bid exceeds committed amount")]
    BidExceedsCommit,
    #[msg("Commitment mismatch")]
    CommitmentMismatch,
    #[msg("Bid already revealed")]
    BidAlreadyRevealed,
    #[msg("Bid already refunded")]
    BidAlreadyRefunded,
    #[msg("Double settlement attempt")]
    AlreadySettled,
    #[msg("No revealed bids")]
    NoRevealedBids,
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("Insufficient escrow balance")]
    InsufficientEscrow,
    #[msg("String exceeds allowed length")]
    StringTooLong,
    #[msg("Invalid sequence id")]
    InvalidSequence,
    #[msg("Cannot cancel after at least one revealed bid")]
    CancelNotAllowed,
    #[msg("Minimum bid must be greater than zero")]
    InvalidMinBid,
    #[msg("Asset token decimals must be zero")]
    InvalidAssetDecimals,
    #[msg("Asset does not belong to this auction")]
    InvalidAuctionAsset,
    #[msg("Auction is not settled")]
    AuctionNotSettled,
    #[msg("Winning bidder account mismatch")]
    WinnerBidderMismatch,
}
