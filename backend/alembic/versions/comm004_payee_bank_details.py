"""Add bank/UPI/wallet payment detail columns to commission_payee.

Revision ID: comm004_payee_bank_details
Revises: comm003_seed_accounts
Create Date: 2026-04-22
"""

revision = "comm004_payee_bank_details"
down_revision = "comm003_seed_accounts"
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa


def upgrade() -> None:
    op.add_column("commission_payee", sa.Column("bank_source", sa.String(10), nullable=True, server_default="master"))
    op.add_column("commission_payee", sa.Column("bank_name", sa.String(100), nullable=True))
    op.add_column("commission_payee", sa.Column("account_number", sa.String(30), nullable=True))
    op.add_column("commission_payee", sa.Column("account_holder_name", sa.String(255), nullable=True))
    op.add_column("commission_payee", sa.Column("ifsc_code", sa.String(15), nullable=True))
    op.add_column("commission_payee", sa.Column("upi_id", sa.String(100), nullable=True))
    op.add_column("commission_payee", sa.Column("wallet_provider", sa.String(50), nullable=True))
    op.add_column("commission_payee", sa.Column("wallet_id", sa.String(100), nullable=True))


def downgrade() -> None:
    for col in ("bank_source", "bank_name", "account_number", "account_holder_name",
                "ifsc_code", "upi_id", "wallet_provider", "wallet_id"):
        op.drop_column("commission_payee", col)
