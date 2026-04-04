use anchor_lang::prelude::*;

use crate::constants::{MAX_METADATA_URI_LEN, MAX_REAL_WORLD_REF_LEN, MAX_TITLE_LEN};

#[account]
#[derive(InitSpace)]
pub struct ProtocolConfig {
    pub admin: Pubkey,
    pub treasury: Pubkey,
    pub fee_bps: u16,
    pub paused: bool,
    pub next_asset_id: u64,
    pub next_auction_id: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Asset {
    pub protocol: Pubkey,
    pub asset_id: u64,
    pub mint: Pubkey,
    pub creator: Pubkey,
    pub current_owner: Pubkey,
    #[max_len(MAX_TITLE_LEN)]
    pub title: String,
    #[max_len(MAX_METADATA_URI_LEN)]
    pub metadata_uri: String,
    #[max_len(MAX_REAL_WORLD_REF_LEN)]
    pub real_world_ref: String,
    pub verification_hash: [u8; 32],
    pub decimals: u8,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
#[repr(u8)]
pub enum AuctionStatus {
    Draft = 0,
    CommitPhase = 1,
    RevealPhase = 2,
    Finalized = 3,
    Cancelled = 4,
}

#[account]
#[derive(InitSpace)]
pub struct Auction {
    pub protocol: Pubkey,
    pub auction_id: u64,
    pub asset: Pubkey,
    pub mint: Pubkey,
    pub seller: Pubkey,
    pub winner: Pubkey,
    pub highest_bidder: Pubkey,
    pub start_ts: i64,
    pub commit_end_ts: i64,
    pub reveal_end_ts: i64,
    pub min_bid_lamports: u64,
    pub highest_revealed_bid_lamports: u64,
    pub status: AuctionStatus,
    pub settled: bool,
    pub bump: u8,
    pub vault_bump: u8,
}

impl Auction {
    pub fn sync_phase(&mut self, now: i64) {
        match self.status {
            AuctionStatus::Draft if now >= self.start_ts => {
                self.status = AuctionStatus::CommitPhase;
            }
            AuctionStatus::CommitPhase if now >= self.commit_end_ts => {
                self.status = AuctionStatus::RevealPhase;
            }
            _ => {}
        }
    }
}

#[account]
#[derive(InitSpace)]
pub struct BidCommit {
    pub auction: Pubkey,
    pub bidder: Pubkey,
    pub commitment: [u8; 32],
    pub committed_amount_lamports: u64,
    pub revealed_amount_lamports: u64,
    pub revealed: bool,
    pub refunded: bool,
    pub is_winner: bool,
    pub bump: u8,
}
