"""Add settlement signature column to escrows table.

Revision ID: 004_escrow_settlement
Revises: 003_bid_chain_fields
Create Date: 2026-04-05
"""

from alembic import op

revision = "004_escrow_settlement"
down_revision = "003_bid_chain_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE escrows ADD COLUMN IF NOT EXISTS settlement_signature VARCHAR"
    )


def downgrade() -> None:
    op.drop_column("escrows", "settlement_signature")
