use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Mint, Token, TokenAccount, TransferChecked},
};

use crate::{
    constants::{PROTOCOL_SEED, TOKENIZED_ASSET_UNITS, VAULT_AUTHORITY_SEED},
    errors::AuctionError,
    state::{Asset, Auction, AuctionStatus, ProtocolConfig},
};

pub fn handler(ctx: Context<CancelAuction>) -> Result<()> {
    require!(!ctx.accounts.protocol.paused, AuctionError::ProtocolPaused);

    let now = Clock::get()?.unix_timestamp;

    let auction = &mut ctx.accounts.auction;
    auction.sync_phase(now);

    match auction.status {
        AuctionStatus::Finalized => return err!(AuctionError::AuctionAlreadyFinalized),
        AuctionStatus::Cancelled => return err!(AuctionError::AuctionAlreadyCancelled),
        _ => {}
    }

    require_keys_eq!(ctx.accounts.seller.key(), auction.seller, AuctionError::UnauthorizedSeller);
    require_keys_eq!(ctx.accounts.asset.key(), auction.asset, AuctionError::InvalidAuctionAsset);
    require_keys_eq!(
        ctx.accounts.asset.protocol,
        auction.protocol,
        AuctionError::InvalidAuctionAsset
    );

    require!(
        auction.highest_revealed_bid_lamports == 0 && auction.highest_bidder == Pubkey::default(),
        AuctionError::CancelNotAllowed
    );

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
            to: ctx.accounts.seller_asset_token_account.to_account_info(),
            authority: ctx.accounts.vault_authority.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
        },
        signer,
    );
    token::transfer_checked(cpi_ctx, TOKENIZED_ASSET_UNITS, ctx.accounts.mint.decimals)?;

    auction.status = AuctionStatus::Cancelled;
    auction.settled = true;

    let asset = &mut ctx.accounts.asset;
    asset.current_owner = ctx.accounts.seller.key();

    Ok(())
}

#[derive(Accounts)]
pub struct CancelAuction<'info> {
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

    #[account(mut, address = auction.seller)]
    pub seller: Signer<'info>,

    /// CHECK: PDA authority over escrowed asset account.
    #[account(
        seeds = [VAULT_AUTHORITY_SEED, auction.key().as_ref()],
        bump = auction.vault_bump
    )]
    pub vault_authority: UncheckedAccount<'info>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = vault_authority
    )]
    pub vault_asset_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = seller
    )]
    pub seller_asset_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}
