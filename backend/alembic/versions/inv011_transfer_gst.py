"""Add GST fields to stock_transfer_order and stock_transfer_order_line.

Revision ID: inv011_transfer_gst
Revises: inv010_movement_document_number
Create Date: 2026-09-07

Changes:
- stock_transfer_order:
    from_state_code VARCHAR(2)   — 2-digit GST state code of source store
    to_state_code   VARCHAR(2)   — 2-digit GST state code of destination
    is_inter_state  BOOLEAN      — True when states differ → IGST applies
    igst_amount     NUMERIC(14,2)— sum of IGST across all lines

- stock_transfer_order_line:
    taxable_value   NUMERIC(14,2)— dispatched_qty × cost_price at dispatch time
    igst_rate       NUMERIC(6,2) — product.gst_rate at dispatch time
    igst_amount     NUMERIC(14,2)— taxable_value × igst_rate / 100

All columns nullable; existing rows remain NULL (pre-GST transfers have no tax).
"""

from alembic import op
import sqlalchemy as sa


revision = "inv011_transfer_gst"
down_revision = "inv010_movement_document_number"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Header-level GST determination
    op.add_column("stock_transfer_order", sa.Column("from_state_code", sa.String(2), nullable=True))
    op.add_column("stock_transfer_order", sa.Column("to_state_code",   sa.String(2), nullable=True))
    op.add_column("stock_transfer_order", sa.Column("is_inter_state",  sa.Boolean(),  nullable=True))
    op.add_column("stock_transfer_order", sa.Column("igst_amount",     sa.Numeric(14, 2), nullable=True, server_default="0"))

    # Line-level GST
    op.add_column("stock_transfer_order_line", sa.Column("taxable_value", sa.Numeric(14, 2), nullable=True))
    op.add_column("stock_transfer_order_line", sa.Column("igst_rate",     sa.Numeric(6, 2),  nullable=True))
    op.add_column("stock_transfer_order_line", sa.Column("igst_amount",   sa.Numeric(14, 2), nullable=True))


def downgrade() -> None:
    op.drop_column("stock_transfer_order_line", "igst_amount")
    op.drop_column("stock_transfer_order_line", "igst_rate")
    op.drop_column("stock_transfer_order_line", "taxable_value")

    op.drop_column("stock_transfer_order", "igst_amount")
    op.drop_column("stock_transfer_order", "is_inter_state")
    op.drop_column("stock_transfer_order", "to_state_code")
    op.drop_column("stock_transfer_order", "from_state_code")
