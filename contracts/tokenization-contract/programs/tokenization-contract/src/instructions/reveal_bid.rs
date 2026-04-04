use anchor_lang::prelude::*;
use solana_program::hash::hashv;

use crate::{
    constants::{BID_COMMIT_SEED, PROTOCOL_SEED},
    errors::AuctionError,
    state::{Auction, AuctionStatus, BidCommit, ProtocolConfig},
};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct RevealBidParams {
    pub amount_lamports: u64,
    pub salt: [u8; 32],
}

pub fn handler(ctx: Context<RevealBid>, params: RevealBidParams) -> Result<()> {
    require!(!ctx.accounts.protocol.paused, AuctionError::ProtocolPaused);

    let now = Clock::get()?.unix_timestamp;
    let auction = &mut ctx.accounts.auction;
    auction.sync_phase(now);

    if now >= auction.commit_end_ts && auction.status == AuctionStatus::CommitPhase {
        auction.status = AuctionStatus::RevealPhase;
    }

    require!(auction.status == AuctionStatus::RevealPhase, AuctionError::InvalidPhase);
    require!(now <= auction.reveal_end_ts, AuctionError::InvalidPhase);

    let bid_commit = &mut ctx.accounts.bid_commit;
    require!(!bid_commit.revealed, AuctionError::BidAlreadyRevealed);
    require!(params.amount_lamports >= auction.min_bid_lamports, AuctionError::BidTooLow);
    require!(
        params.amount_lamports <= bid_commit.committed_amount_lamports,
        AuctionError::BidExceedsCommit
    );

    let digest = hashv(&[
        auction.key().as_ref(),
        ctx.accounts.bidder.key().as_ref(),
        &params.amount_lamports.to_le_bytes(),
        &params.salt,
    ]);
    require!(digest.to_bytes() == bid_commit.commitment, AuctionError::CommitmentMismatch);

    bid_commit.revealed = true;
    bid_commit.revealed_amount_lamports = params.amount_lamports;

    if params.amount_lamports > auction.highest_revealed_bid_lamports {
        auction.highest_revealed_bid_lamports = params.amount_lamports;
        auction.highest_bidder = ctx.accounts.bidder.key();
    }

    Ok(())
}

#[derive(Accounts)]
pub struct RevealBid<'info> {
    #[account(
        seeds = [PROTOCOL_SEED],
        bump = protocol.bump,
        address = auction.protocol
    )]
    pub protocol: Account<'info, ProtocolConfig>,

    #[account(mut)]
    pub auction: Account<'info, Auction>,

    #[account(mut)]
    pub bidder: Signer<'info>,

    #[account(
        mut,
        seeds = [BID_COMMIT_SEED, auction.key().as_ref(), bidder.key().as_ref()],
        bump = bid_commit.bump,
        has_one = auction,
        has_one = bidder
    )]
    pub bid_commit: Account<'info, BidCommit>,
}
