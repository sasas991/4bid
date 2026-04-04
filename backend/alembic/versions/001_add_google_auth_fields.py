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
    op.add_column("users", sa.Column("email", sa.String(), nullable=True))
    op.add_column("users", sa.Column("google_id", sa.String(), nullable=True))
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)
    op.create_index(
        op.f("ix_users_google_id"), "users", ["google_id"], unique=True
    )
    op.alter_column(
        "users", "wallet_address", existing_type=sa.String(), nullable=True
    )


def downgrade() -> None:
    op.alter_column(
        "users", "wallet_address", existing_type=sa.String(), nullable=False
    )
    op.drop_index(op.f("ix_users_google_id"), table_name="users")
    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_column("users", "google_id")
    op.drop_column("users", "email")
