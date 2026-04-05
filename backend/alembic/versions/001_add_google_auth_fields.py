"""Add google_id and email to users, make wallet_address nullable.

Revision ID: 001_google_auth
Revises:
Create Date: 2026-04-04
"""

from alembic import op
import sqlalchemy as sa

revision = "001_google_auth"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # IF NOT EXISTS makes this safe to run on a DB already created by create_all.
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR")
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_users_email ON users (email)"
    )
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_users_google_id ON users (google_id)"
    )
    # DROP NOT NULL is idempotent in PostgreSQL.
    op.execute(
        "ALTER TABLE users ALTER COLUMN wallet_address DROP NOT NULL"
    )


def downgrade() -> None:
    op.alter_column(
        "users", "wallet_address", existing_type=sa.String(), nullable=False
    )
    op.drop_index(op.f("ix_users_google_id"), table_name="users")
    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_column("users", "google_id")
    op.drop_column("users", "email")
