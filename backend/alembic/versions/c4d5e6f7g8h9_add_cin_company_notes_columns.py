"""add cin, company_name to supplier; cin, notes to customer

Revision ID: c4d5e6f7g8h9
Revises: aa1bb2cc3dd4
Create Date: 2026-04-14

"""
from alembic import op
import sqlalchemy as sa

revision = "c4d5e6f7g8h9"
down_revision = "aa1bb2cc3dd4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("customer", sa.Column("cin", sa.String(21), nullable=True))
    op.add_column("customer", sa.Column("notes", sa.Text, nullable=True))

    op.add_column("supplier", sa.Column("cin", sa.String(21), nullable=True))
    op.add_column("supplier", sa.Column("company_name", sa.String(255), nullable=True))


def downgrade() -> None:
    op.drop_column("supplier", "company_name")
    op.drop_column("supplier", "cin")

    op.drop_column("customer", "notes")
    op.drop_column("customer", "cin")
