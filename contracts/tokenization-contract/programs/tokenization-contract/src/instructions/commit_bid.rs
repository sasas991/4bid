use anchor_lang::prelude::*;
use anchor_lang::system_program::{self, Transfer};

use crate::{
    constants::{BID_COMMIT_SEED, PROTOCOL_SEED},
    errors::AuctionError,
    state::{Auction, AuctionStatus, BidCommit, ProtocolConfig},
};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct CommitBidParams {
    pub commitment: [u8; 32],
    pub committed_amount_lamports: u64,
}

pub fn handler(ctx: Context<CommitBid>, params: CommitBidParams) -> Result<()> {
    require!(!ctx.accounts.protocol.paused, AuctionError::ProtocolPaused);

    let now = Clock::get()?.unix_timestamp;
    let auction = &mut ctx.accounts.auction;
    auction.sync_phase(now);

    require!(auction.status == AuctionStatus::CommitPhase, AuctionError::InvalidPhase);
    require!(now < auction.commit_end_ts, AuctionError::InvalidPhase);
    require!(params.committed_amount_lamports >= auction.min_bid_lamports, AuctionError::BidTooLow);

    let bid_commit = &mut ctx.accounts.bid_commit;
    bid_commit.auction = auction.key();
    bid_commit.bidder = ctx.accounts.bidder.key();
    bid_commit.commitment = params.commitment;
    bid_commit.committed_amount_lamports = params.committed_amount_lamports;
    bid_commit.revealed_amount_lamports = 0;
    bid_commit.revealed = false;
    bid_commit.refunded = false;
    bid_commit.is_winner = false;
    bid_commit.bump = ctx.bumps.bid_commit;

    let cpi_ctx = CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        Transfer {
            from: ctx.accounts.bidder.to_account_info(),
            to: ctx.accounts.bid_commit.to_account_info(),
        },
    );
    system_program::transfer(cpi_ctx, params.committed_amount_lamports)?;

    Ok(())
}

#[derive(Accounts)]
pub struct CommitBid<'info> {
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
        init,
        payer = bidder,
        space = 8 + BidCommit::INIT_SPACE,
        seeds = [BID_COMMIT_SEED, auction.key().as_ref(), bidder.key().as_ref()],
        bump
    )]
    pub bid_commit: Account<'info, BidCommit>,

    pub system_program: Program<'info, System>,
}
