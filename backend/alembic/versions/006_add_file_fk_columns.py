"""Add image_file_id FK to auctions and avatar_file_id FK to users.

Revision ID: 006_add_file_fk_columns
Revises: 005_add_files_table
Create Date: 2026-04-06
"""

from alembic import op

revision = "006_add_file_fk_columns"
down_revision = "005_add_files_table"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE users
            ADD COLUMN IF NOT EXISTS avatar_file_id INTEGER REFERENCES files(id) ON DELETE SET NULL
    """)
    op.execute("""
        ALTER TABLE auctions
            ADD COLUMN IF NOT EXISTS image_file_id INTEGER REFERENCES files(id) ON DELETE SET NULL
    """)


def downgrade() -> None:
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS avatar_file_id")
    op.execute("ALTER TABLE auctions DROP COLUMN IF EXISTS image_file_id")
