use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Mint, Token, TokenAccount, TransferChecked},
};

use crate::{
    constants::{
        AUCTION_SEED, MAX_AUCTION_DURATION, MIN_COMMIT_DURATION, MIN_REVEAL_DURATION, PROTOCOL_SEED,
        TOKENIZED_ASSET_UNITS, VAULT_AUTHORITY_SEED,
    },
    errors::AuctionError,
    state::{Asset, Auction, AuctionStatus, ProtocolConfig},
};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct CreateAuctionParams {
    pub auction_id: u64,
    pub start_ts: i64,
    pub commit_end_ts: i64,
    pub reveal_end_ts: i64,
    pub min_bid_lamports: u64,
}

pub fn handler(ctx: Context<CreateAuction>, params: CreateAuctionParams) -> Result<()> {
    require!(!ctx.accounts.protocol.paused, AuctionError::ProtocolPaused);
    require!(params.min_bid_lamports > 0, AuctionError::InvalidMinBid);
    require_keys_eq!(
        ctx.accounts.asset.protocol,
        ctx.accounts.protocol.key(),
        AuctionError::InvalidAuctionAsset
    );
    require_keys_eq!(ctx.accounts.asset.current_owner, ctx.accounts.seller.key(), AuctionError::UnauthorizedSeller);

    let now = Clock::get()?.unix_timestamp;
    require!(params.start_ts >= now, AuctionError::InvalidTimeWindow);
    require!(params.commit_end_ts > params.start_ts, AuctionError::InvalidTimeWindow);
    require!(params.reveal_end_ts > params.commit_end_ts, AuctionError::InvalidTimeWindow);

    let commit_duration = params
        .commit_end_ts
        .checked_sub(params.start_ts)
        .ok_or(AuctionError::MathOverflow)?;
    let reveal_duration = params
        .reveal_end_ts
        .checked_sub(params.commit_end_ts)
        .ok_or(AuctionError::MathOverflow)?;
    let total_duration = params
        .reveal_end_ts
        .checked_sub(params.start_ts)
        .ok_or(AuctionError::MathOverflow)?;

    require!(commit_duration >= MIN_COMMIT_DURATION, AuctionError::InvalidTimeWindow);
    require!(reveal_duration >= MIN_REVEAL_DURATION, AuctionError::InvalidTimeWindow);
    require!(total_duration <= MAX_AUCTION_DURATION, AuctionError::InvalidTimeWindow);

    let protocol = &mut ctx.accounts.protocol;
    require!(params.auction_id == protocol.next_auction_id, AuctionError::InvalidSequence);

    let auction = &mut ctx.accounts.auction;
    auction.protocol = protocol.key();
    auction.auction_id = params.auction_id;
    auction.asset = ctx.accounts.asset.key();
    auction.mint = ctx.accounts.mint.key();
    auction.seller = ctx.accounts.seller.key();
    auction.winner = Pubkey::default();
    auction.highest_bidder = Pubkey::default();
    auction.start_ts = params.start_ts;
    auction.commit_end_ts = params.commit_end_ts;
    auction.reveal_end_ts = params.reveal_end_ts;
    auction.min_bid_lamports = params.min_bid_lamports;
    auction.highest_revealed_bid_lamports = 0;
    auction.status = AuctionStatus::Draft;
    auction.settled = false;
    auction.bump = ctx.bumps.auction;
    auction.vault_bump = ctx.bumps.vault_authority;

    protocol.next_auction_id = protocol
        .next_auction_id
        .checked_add(1)
        .ok_or(AuctionError::MathOverflow)?;

    let cpi_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        TransferChecked {
            from: ctx.accounts.seller_asset_token_account.to_account_info(),
            to: ctx.accounts.vault_asset_token_account.to_account_info(),
            authority: ctx.accounts.seller.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
        },
    );
    token::transfer_checked(cpi_ctx, TOKENIZED_ASSET_UNITS, ctx.accounts.mint.decimals)?;

    Ok(())
}

#[derive(Accounts)]
#[instruction(params: CreateAuctionParams)]
pub struct CreateAuction<'info> {
    #[account(
        mut,
        seeds = [PROTOCOL_SEED],
        bump = protocol.bump
    )]
    pub protocol: Account<'info, ProtocolConfig>,

    #[account(mut)]
    pub seller: Signer<'info>,

    #[account(
        mut,
        has_one = mint,
        constraint = asset.current_owner == seller.key() @ AuctionError::UnauthorizedSeller
    )]
    pub asset: Account<'info, Asset>,

    pub mint: Account<'info, Mint>,

    #[account(
        init,
        payer = seller,
        space = 8 + Auction::INIT_SPACE,
        seeds = [AUCTION_SEED, asset.key().as_ref(), &params.auction_id.to_le_bytes()],
        bump
    )]
    pub auction: Account<'info, Auction>,

    /// CHECK: PDA that owns escrowed asset token account.
    #[account(
        seeds = [VAULT_AUTHORITY_SEED, auction.key().as_ref()],
        bump
    )]
    pub vault_authority: UncheckedAccount<'info>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = seller
    )]
    pub seller_asset_token_account: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = seller,
        associated_token::mint = mint,
        associated_token::authority = vault_authority
    )]
    pub vault_asset_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}
