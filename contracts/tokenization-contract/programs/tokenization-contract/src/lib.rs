use anchor_lang::prelude::*;

pub mod constants;
pub mod errors;
pub mod instructions;
pub mod state;

pub use instructions::cancel_auction::CancelAuction;
pub use instructions::commit_bid::{CommitBid, CommitBidParams};
pub use instructions::create_asset::{CreateAsset, CreateAssetParams};
pub use instructions::create_auction::{CreateAuction, CreateAuctionParams};
pub use instructions::finalize_auction::{FinalizeAuctionState, SettleWinnerAssetAndFunds};
pub use instructions::initialize_protocol::InitializeProtocol;
pub use instructions::refund_loser::RefundLoser;
pub use instructions::reveal_bid::{RevealBid, RevealBidParams};
use instructions::{
    cancel_auction::__client_accounts_cancel_auction,
    commit_bid::__client_accounts_commit_bid,
    create_asset::__client_accounts_create_asset,
    create_auction::__client_accounts_create_auction,
    finalize_auction::__client_accounts_finalize_auction_state,
    finalize_auction::__client_accounts_settle_winner_asset_and_funds,
    initialize_protocol::__client_accounts_initialize_protocol,
    refund_loser::__client_accounts_refund_loser,
    reveal_bid::__client_accounts_reveal_bid,
};

use instructions::{
    cancel_auction::{self},
    commit_bid::{self},
    create_asset::{self},
    create_auction::{self},
    finalize_auction::{self},
    initialize_protocol::{self},
    refund_loser::{self},
    reveal_bid::{self},
};

declare_id!("BLt6gcTzkeyZ5ygxem5AZSFQ3TyanAzkmRVDnyRNHHC2");

#[program]
pub mod tokenization_contract {
    use super::*;

    pub fn initialize_protocol(
        ctx: Context<InitializeProtocol>,
        fee_bps: u16,
    ) -> Result<()> {
        initialize_protocol::handler(ctx, fee_bps)
    }

    pub fn create_asset(
        ctx: Context<CreateAsset>,
        params: CreateAssetParams,
    ) -> Result<()> {
        create_asset::handler(ctx, params)
    }

    pub fn create_auction(
        ctx: Context<CreateAuction>,
        params: CreateAuctionParams,
    ) -> Result<()> {
        create_auction::handler(ctx, params)
    }

    pub fn commit_bid(
        ctx: Context<CommitBid>,
        params: CommitBidParams,
    ) -> Result<()> {
        commit_bid::handler(ctx, params)
    }

    pub fn reveal_bid(
        ctx: Context<RevealBid>,
        params: RevealBidParams,
    ) -> Result<()> {
        reveal_bid::handler(ctx, params)
    }

    pub fn finalize_auction_state(ctx: Context<FinalizeAuctionState>) -> Result<()> {
        finalize_auction::finalize_auction_state_handler(ctx)
    }

    pub fn settle_winner_asset_and_funds(
        ctx: Context<SettleWinnerAssetAndFunds>,
    ) -> Result<()> {
        finalize_auction::settle_winner_asset_and_funds_handler(ctx)
    }

    pub fn refund_loser(ctx: Context<RefundLoser>) -> Result<()> {
        refund_loser::handler(ctx)
    }

    pub fn cancel_auction(ctx: Context<CancelAuction>) -> Result<()> {
        cancel_auction::handler(ctx)
    }
}
