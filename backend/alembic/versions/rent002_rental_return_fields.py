"""Add asset-return fields to rental_booking.

Revision ID: rent002_rental_return_fields
Revises: rent001_rental_asset_management
Create Date: 2026-08-04

Adds returned_at, quantity_returned, return_condition, damage_charge,
late_fee, deposit_refunded so that vendor can record a proper return
with partial quantity support and financial settlement.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "rent002_rental_return_fields"
down_revision = "rent001_rental_asset_management"
branch_labels = None
depends_on = None


def _has_column(insp, table: str, column: str) -> bool:
    if not insp.has_table(table):
        return False
    return any(c["name"] == column for c in insp.get_columns(table))


def _add(insp, table: str, column: str, col):
    if not _has_column(insp, table, column):
        op.add_column(table, col)


def upgrade() -> None:
    bind = op.get_bind()
    insp = inspect(bind)

    if not insp.has_table("rental_booking"):
        return

    _add(insp, "rental_booking", "returned_at",
         sa.Column("returned_at", sa.DateTime(timezone=True), nullable=True))
    _add(insp, "rental_booking", "quantity_returned",
         sa.Column("quantity_returned", sa.Numeric(12, 2), nullable=True))
    _add(insp, "rental_booking", "return_condition",
         sa.Column("return_condition", sa.String(20), nullable=True))
    _add(insp, "rental_booking", "damage_charge",
         sa.Column("damage_charge", sa.Numeric(12, 2), server_default="0"))
    _add(insp, "rental_booking", "late_fee",
         sa.Column("late_fee", sa.Numeric(12, 2), server_default="0"))
    _add(insp, "rental_booking", "deposit_refunded",
         sa.Column("deposit_refunded", sa.Numeric(12, 2), server_default="0"))
    _add(insp, "rental_booking", "return_notes",
         sa.Column("return_notes", sa.Text(), nullable=True))


def downgrade() -> None:
    # Non-destructive: keep columns.
    pass
