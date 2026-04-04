use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Mint, MintTo, Token, TokenAccount},
};

use crate::{
    constants::{ASSET_SEED, MAX_METADATA_URI_LEN, MAX_REAL_WORLD_REF_LEN, MAX_TITLE_LEN, PROTOCOL_SEED, TOKENIZED_ASSET_UNITS},
    errors::AuctionError,
    state::{Asset, ProtocolConfig},
};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct CreateAssetParams {
    pub asset_id: u64,
    pub title: String,
    pub metadata_uri: String,
    pub real_world_ref: String,
    pub verification_hash: [u8; 32],
    pub decimals: u8,
}

pub fn handler(ctx: Context<CreateAsset>, params: CreateAssetParams) -> Result<()> {
    require!(!ctx.accounts.protocol.paused, AuctionError::ProtocolPaused);
    require!(params.decimals == 0, AuctionError::InvalidAssetDecimals);
    require!(params.title.len() <= MAX_TITLE_LEN, AuctionError::StringTooLong);
    require!(
        params.metadata_uri.len() <= MAX_METADATA_URI_LEN,
        AuctionError::StringTooLong
    );
    require!(
        params.real_world_ref.len() <= MAX_REAL_WORLD_REF_LEN,
        AuctionError::StringTooLong
    );

    let protocol = &mut ctx.accounts.protocol;
    require!(params.asset_id == protocol.next_asset_id, AuctionError::InvalidSequence);

    let asset = &mut ctx.accounts.asset;
    asset.protocol = protocol.key();
    asset.asset_id = params.asset_id;
    asset.mint = ctx.accounts.mint.key();
    asset.creator = ctx.accounts.creator.key();
    asset.current_owner = ctx.accounts.creator.key();
    asset.title = params.title;
    asset.metadata_uri = params.metadata_uri;
    asset.real_world_ref = params.real_world_ref;
    asset.verification_hash = params.verification_hash;
    asset.decimals = params.decimals;
    asset.bump = ctx.bumps.asset;

    protocol.next_asset_id = protocol
        .next_asset_id
        .checked_add(1)
        .ok_or(AuctionError::MathOverflow)?;

    let cpi_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        MintTo {
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.creator_token_account.to_account_info(),
            authority: ctx.accounts.creator.to_account_info(),
        },
    );
    token::mint_to(cpi_ctx, TOKENIZED_ASSET_UNITS)?;

    Ok(())
}

#[derive(Accounts)]
#[instruction(params: CreateAssetParams)]
pub struct CreateAsset<'info> {
    #[account(
        mut,
        seeds = [PROTOCOL_SEED],
        bump = protocol.bump
    )]
    pub protocol: Account<'info, ProtocolConfig>,

    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        init,
        payer = creator,
        space = 8 + Asset::INIT_SPACE,
        seeds = [ASSET_SEED, protocol.key().as_ref(), &params.asset_id.to_le_bytes()],
        bump
    )]
    pub asset: Account<'info, Asset>,

    #[account(
        init,
        payer = creator,
        mint::decimals = params.decimals,
        mint::authority = creator,
        mint::freeze_authority = creator
    )]
    pub mint: Account<'info, Mint>,

    #[account(
        init_if_needed,
        payer = creator,
        associated_token::mint = mint,
        associated_token::authority = creator
    )]
    pub creator_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}
