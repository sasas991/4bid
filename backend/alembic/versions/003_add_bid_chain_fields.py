"""Add on-chain bid columns to bids table.

Revision ID: 003_bid_chain_fields
Revises: 002_auction_chain_fields
Create Date: 2026-04-05
"""

from alembic import op

revision = "003_bid_chain_fields"
down_revision = "002_auction_chain_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Safe for existing databases created from older schema versions.
    op.execute(
        "ALTER TABLE bids ADD COLUMN IF NOT EXISTS bid_commit_pubkey VARCHAR"
    )
    op.execute(
        "ALTER TABLE bids ADD COLUMN IF NOT EXISTS commit_signature VARCHAR"
    )
    op.execute(
        "ALTER TABLE bids ADD COLUMN IF NOT EXISTS reveal_signature VARCHAR"
    )
    op.execute(
        "ALTER TABLE bids ADD COLUMN IF NOT EXISTS revealed_amount DOUBLE PRECISION"
    )
    op.execute(
        "ALTER TABLE bids ADD COLUMN IF NOT EXISTS on_chain INTEGER"
    )

    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_bids_bid_commit_pubkey"
        " ON bids (bid_commit_pubkey)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_bids_bid_commit_pubkey")

    op.drop_column("bids", "on_chain")
    op.drop_column("bids", "revealed_amount")
    op.drop_column("bids", "reveal_signature")
    op.drop_column("bids", "commit_signature")
    op.drop_column("bids", "bid_commit_pubkey")
