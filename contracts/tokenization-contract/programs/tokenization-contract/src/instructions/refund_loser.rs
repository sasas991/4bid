use anchor_lang::prelude::*;

use crate::{
    constants::{BID_COMMIT_SEED, PROTOCOL_SEED},
    errors::AuctionError,
    state::{Auction, AuctionStatus, BidCommit, ProtocolConfig},
};

pub fn handler(ctx: Context<RefundLoser>) -> Result<()> {
    require!(!ctx.accounts.protocol.paused, AuctionError::ProtocolPaused);

    let auction = &ctx.accounts.auction;
    let bid_commit = &ctx.accounts.bid_commit;

    require!(!bid_commit.refunded, AuctionError::BidAlreadyRefunded);

    let refund_amount = match auction.status {
        AuctionStatus::Cancelled => bid_commit.committed_amount_lamports,
        AuctionStatus::Finalized => {
            require!(auction.settled, AuctionError::AuctionNotSettled);
            if bid_commit.is_winner {
                bid_commit
                    .committed_amount_lamports
                    .checked_sub(auction.highest_revealed_bid_lamports)
                    .ok_or(AuctionError::MathOverflow)?
            } else {
                bid_commit.committed_amount_lamports
            }
        }
        _ => return err!(AuctionError::InvalidPhase),
    };

    transfer_lamports_from_bid(
        &ctx.accounts.bid_commit.to_account_info(),
        &ctx.accounts.bidder.to_account_info(),
        refund_amount,
    )?;

    ctx.accounts.bid_commit.refunded = true;

    Ok(())
}

fn transfer_lamports_from_bid(source: &AccountInfo, destination: &AccountInfo, amount: u64) -> Result<()> {
    if amount == 0 {
        return Ok(());
    }

    let source_lamports = source.lamports();
    require!(source_lamports >= amount, AuctionError::InsufficientEscrow);

    **source.try_borrow_mut_lamports()? = source_lamports
        .checked_sub(amount)
        .ok_or(AuctionError::MathOverflow)?;

    let destination_lamports = destination.lamports();
    **destination.try_borrow_mut_lamports()? = destination_lamports
        .checked_add(amount)
        .ok_or(AuctionError::MathOverflow)?;

    Ok(())
}

#[derive(Accounts)]
pub struct RefundLoser<'info> {
    #[account(
        seeds = [PROTOCOL_SEED],
        bump = protocol.bump,
        address = auction.protocol
    )]
    pub protocol: Account<'info, ProtocolConfig>,

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
