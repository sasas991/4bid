use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Mint, Token, TokenAccount, TransferChecked},
};

use crate::{
    constants::{BID_COMMIT_SEED, BPS_DENOMINATOR, PROTOCOL_SEED, TOKENIZED_ASSET_UNITS, VAULT_AUTHORITY_SEED},
    errors::AuctionError,
    state::{Asset, Auction, AuctionStatus, BidCommit, ProtocolConfig},
};

pub fn finalize_auction_state_handler(ctx: Context<FinalizeAuctionState>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;

    let protocol = &ctx.accounts.protocol;
    let auction = &mut ctx.accounts.auction;
    auction.sync_phase(now);

    require!(auction.status == AuctionStatus::RevealPhase, AuctionError::InvalidPhase);
    require!(now > auction.reveal_end_ts, AuctionError::NotFinalizableYet);
    require!(!auction.settled, AuctionError::AlreadySettled);

    require!(auction.highest_bidder != Pubkey::default(), AuctionError::NoRevealedBids);
    require!(
        auction.highest_revealed_bid_lamports > 0,
        AuctionError::NoRevealedBids
    );

    {
        let winning_bid = &ctx.accounts.winning_bid_commit;
        require!(winning_bid.revealed, AuctionError::NoRevealedBids);
        require!(!winning_bid.refunded, AuctionError::BidAlreadyRefunded);
        require_keys_eq!(winning_bid.bidder, auction.highest_bidder, AuctionError::NoRevealedBids);
        require!(
            winning_bid.revealed_amount_lamports == auction.highest_revealed_bid_lamports,
            AuctionError::NoRevealedBids
        );
    }

    let total = auction.highest_revealed_bid_lamports;
    let fee = total
        .checked_mul(protocol.fee_bps as u64)
        .ok_or(AuctionError::MathOverflow)?
        .checked_div(BPS_DENOMINATOR)
        .ok_or(AuctionError::MathOverflow)?;
    let seller_amount = total.checked_sub(fee).ok_or(AuctionError::MathOverflow)?;

    transfer_lamports_from_bid(
        &ctx.accounts.winning_bid_commit.to_account_info(),
        &ctx.accounts.seller.to_account_info(),
        seller_amount,
    )?;

    if fee > 0 {
        transfer_lamports_from_bid(
            &ctx.accounts.winning_bid_commit.to_account_info(),
            &ctx.accounts.treasury.to_account_info(),
            fee,
        )?;
    }

    auction.winner = auction.highest_bidder;
    auction.status = AuctionStatus::Finalized;
    auction.settled = true;
    ctx.accounts.winning_bid_commit.is_winner = true;

    Ok(())
}

pub fn settle_winner_asset_and_funds_handler(
    ctx: Context<SettleWinnerAssetAndFunds>,
) -> Result<()> {
    let auction = &ctx.accounts.auction;

    require!(auction.status == AuctionStatus::Finalized, AuctionError::InvalidPhase);
    require!(auction.settled, AuctionError::AuctionNotSettled);

    require_keys_eq!(ctx.accounts.asset.key(), auction.asset, AuctionError::InvalidAuctionAsset);
    require_keys_eq!(
        ctx.accounts.asset.protocol,
        auction.protocol,
        AuctionError::InvalidAuctionAsset
    );

    require_keys_eq!(ctx.accounts.winner.key(), auction.winner, AuctionError::WinnerBidderMismatch);
    require_keys_eq!(ctx.accounts.asset.current_owner, auction.seller, AuctionError::InvalidAuctionAsset);

    require_keys_eq!(ctx.accounts.vault_asset_token_account.mint, ctx.accounts.mint.key(), AuctionError::InvalidAuctionAsset);
    require_keys_eq!(ctx.accounts.vault_asset_token_account.owner, ctx.accounts.vault_authority.key(), AuctionError::InvalidAuctionAsset);
    require_keys_eq!(ctx.accounts.winner_asset_token_account.mint, ctx.accounts.mint.key(), AuctionError::InvalidAuctionAsset);
    require_keys_eq!(ctx.accounts.winner_asset_token_account.owner, ctx.accounts.winner.key(), AuctionError::WinnerBidderMismatch);

    let auction_key = auction.key();
    let signer_seeds: &[&[u8]] = &[
        VAULT_AUTHORITY_SEED,
        auction_key.as_ref(),
        &[auction.vault_bump],
    ];
    let signer: &[&[&[u8]]] = &[signer_seeds];

    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        TransferChecked {
            from: ctx.accounts.vault_asset_token_account.to_account_info(),
            to: ctx.accounts.winner_asset_token_account.to_account_info(),
            authority: ctx.accounts.vault_authority.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
        },
        signer,
    );
    token::transfer_checked(cpi_ctx, TOKENIZED_ASSET_UNITS, ctx.accounts.mint.decimals)?;

    let asset = &mut ctx.accounts.asset;
    asset.current_owner = ctx.accounts.winner.key();

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
pub struct FinalizeAuctionState<'info> {
    #[account(
        seeds = [PROTOCOL_SEED],
        bump = protocol.bump,
        address = auction.protocol
    )]
    pub protocol: Account<'info, ProtocolConfig>,

    #[account(mut)]
    pub auction: Account<'info, Auction>,

    #[account(
        mut,
        seeds = [BID_COMMIT_SEED, auction.key().as_ref(), auction.highest_bidder.as_ref()],
        bump = winning_bid_commit.bump,
        has_one = auction,
    )]
    pub winning_bid_commit: Account<'info, BidCommit>,

    #[account(mut, address = auction.seller)]
    /// CHECK: seller settlement destination.
    pub seller: UncheckedAccount<'info>,

    #[account(mut, address = protocol.treasury)]
    /// CHECK: treasury settlement destination.
    pub treasury: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct SettleWinnerAssetAndFunds<'info> {
    #[account(
        seeds = [PROTOCOL_SEED],
        bump = protocol.bump,
        address = auction.protocol
    )]
    pub protocol: Account<'info, ProtocolConfig>,

    #[account(mut)]
    pub auction: Account<'info, Auction>,

    #[account(mut, has_one = mint)]
    pub asset: Account<'info, Asset>,

    pub mint: Account<'info, Mint>,

    /// CHECK: winner account is validated against auction.winner.
    pub winner: UncheckedAccount<'info>,

    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: PDA authority for asset vault.
    #[account(
        seeds = [VAULT_AUTHORITY_SEED, auction.key().as_ref()],
        bump = auction.vault_bump
    )]
    pub vault_authority: UncheckedAccount<'info>,

    #[account(mut)]
    pub vault_asset_token_account: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = mint,
        associated_token::authority = winner
    )]
    pub winner_asset_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}
