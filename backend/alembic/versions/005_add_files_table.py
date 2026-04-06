"""Add files table for S3 file metadata.

Revision ID: 005_add_files_table
Revises: 004_escrow_settlement
Create Date: 2026-04-06
"""

from alembic import op
import sqlalchemy as sa

revision = "005_add_files_table"
down_revision = "004_escrow_settlement"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS files (
            id SERIAL PRIMARY KEY,
            s3_key VARCHAR NOT NULL UNIQUE,
            original_filename VARCHAR NOT NULL,
            content_type VARCHAR NOT NULL,
            size_bytes INTEGER,
            uploaded_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            created_at TIMESTAMP DEFAULT NOW()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_files_id ON files (id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_files_s3_key ON files (s3_key)")


def downgrade() -> None:
    op.drop_table("files")
