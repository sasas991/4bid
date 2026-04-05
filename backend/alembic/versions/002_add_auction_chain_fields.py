"""Add on-chain mirror columns to auctions table.

Revision ID: 002_auction_chain_fields
Revises: 001_google_auth
Create Date: 2026-04-05
"""

from alembic import op

revision = "002_auction_chain_fields"
down_revision = "001_google_auth"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # All ADD COLUMN … IF NOT EXISTS — safe to run on a DB already at current schema.
    op.execute(
        "ALTER TABLE auctions ADD COLUMN IF NOT EXISTS auction_pubkey VARCHAR"
    )
    op.execute(
        "ALTER TABLE auctions ADD COLUMN IF NOT EXISTS asset_pubkey VARCHAR"
    )
    op.execute(
        "ALTER TABLE auctions ADD COLUMN IF NOT EXISTS mint_pubkey VARCHAR"
    )
    op.execute(
        "ALTER TABLE auctions ADD COLUMN IF NOT EXISTS seller_pubkey VARCHAR"
    )
    op.execute(
        "ALTER TABLE auctions ADD COLUMN IF NOT EXISTS winner_pubkey VARCHAR"
    )
    op.execute(
        "ALTER TABLE auctions ADD COLUMN IF NOT EXISTS chain_status VARCHAR"
    )
    op.execute(
        "ALTER TABLE auctions ADD COLUMN IF NOT EXISTS finalize_signature VARCHAR"
    )
    op.execute(
        "ALTER TABLE auctions ADD COLUMN IF NOT EXISTS settlement_signature VARCHAR"
    )
    op.execute(
        "ALTER TABLE auctions ADD COLUMN IF NOT EXISTS cancel_signature VARCHAR"
    )
    op.execute(
        "ALTER TABLE auctions ADD COLUMN IF NOT EXISTS last_synced_slot INTEGER"
    )

    # Indexes — all IF NOT EXISTS.
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_auctions_auction_pubkey"
        " ON auctions (auction_pubkey)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_auctions_asset_pubkey"
        " ON auctions (asset_pubkey)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_auctions_mint_pubkey"
        " ON auctions (mint_pubkey)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_auctions_seller_pubkey"
        " ON auctions (seller_pubkey)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_auctions_winner_pubkey"
        " ON auctions (winner_pubkey)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_auctions_chain_status"
        " ON auctions (chain_status)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_auctions_chain_status")
    op.execute("DROP INDEX IF EXISTS ix_auctions_winner_pubkey")
    op.execute("DROP INDEX IF EXISTS ix_auctions_seller_pubkey")
    op.execute("DROP INDEX IF EXISTS ix_auctions_mint_pubkey")
    op.execute("DROP INDEX IF EXISTS ix_auctions_asset_pubkey")
    op.execute("DROP INDEX IF EXISTS ix_auctions_auction_pubkey")

    op.drop_column("auctions", "last_synced_slot")
    op.drop_column("auctions", "cancel_signature")
    op.drop_column("auctions", "settlement_signature")
    op.drop_column("auctions", "finalize_signature")
    op.drop_column("auctions", "chain_status")
    op.drop_column("auctions", "winner_pubkey")
    op.drop_column("auctions", "seller_pubkey")
    op.drop_column("auctions", "mint_pubkey")
    op.drop_column("auctions", "asset_pubkey")
    op.drop_column("auctions", "auction_pubkey")
