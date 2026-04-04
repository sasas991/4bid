use anchor_lang::prelude::*;

use crate::{
    constants::{MAX_FEE_BPS, PROTOCOL_SEED},
    errors::AuctionError,
    state::ProtocolConfig,
};

pub fn handler(ctx: Context<InitializeProtocol>, fee_bps: u16) -> Result<()> {
    require!(fee_bps <= MAX_FEE_BPS, AuctionError::InvalidFeeBps);

    let protocol = &mut ctx.accounts.protocol;
    protocol.admin = ctx.accounts.admin.key();
    protocol.treasury = ctx.accounts.treasury.key();
    protocol.fee_bps = fee_bps;
    protocol.paused = false;
    protocol.next_asset_id = 1;
    protocol.next_auction_id = 1;
    protocol.bump = ctx.bumps.protocol;

    Ok(())
}

#[derive(Accounts)]
pub struct InitializeProtocol<'info> {
    #[account(
        init,
        payer = admin,
        space = 8 + ProtocolConfig::INIT_SPACE,
        seeds = [PROTOCOL_SEED],
        bump
    )]
    pub protocol: Account<'info, ProtocolConfig>,
    #[account(mut)]
    pub admin: Signer<'info>,
    /// CHECK: protocol fee recipient address.
    pub treasury: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}
