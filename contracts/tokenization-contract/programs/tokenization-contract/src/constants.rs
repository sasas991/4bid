pub const PROTOCOL_SEED: &[u8] = b"protocol";
pub const ASSET_SEED: &[u8] = b"asset";
pub const AUCTION_SEED: &[u8] = b"auction";
pub const BID_COMMIT_SEED: &[u8] = b"bid_commit";
pub const VAULT_AUTHORITY_SEED: &[u8] = b"vault_authority";

pub const MAX_TITLE_LEN: usize = 96;
pub const MAX_METADATA_URI_LEN: usize = 256;
pub const MAX_REAL_WORLD_REF_LEN: usize = 128;

pub const MAX_FEE_BPS: u16 = 1_000; // 10%
pub const BPS_DENOMINATOR: u64 = 10_000;

pub const TOKENIZED_ASSET_UNITS: u64 = 1;

pub const MIN_COMMIT_DURATION: i64 = 60;
pub const MIN_REVEAL_DURATION: i64 = 60;
pub const MAX_AUCTION_DURATION: i64 = 30 * 24 * 60 * 60;
