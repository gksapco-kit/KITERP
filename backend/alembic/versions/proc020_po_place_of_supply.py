"""Add place_of_supply to purchase_order; backfill GST tax split assessment view.

Revision ID: proc020_po_place_of_supply
Revises: proc019_po_item_service_id
Create Date: 2026-09-07

Changes:
- purchase_order.place_of_supply: nullable VARCHAR(2) storing 2-digit GST state
  code derived from the supplier GSTIN at the time the PO is created.
  "intra"  → supplier and recipient in same state → CGST + SGST
  "inter"  → cross-state → IGST
  NULL     → unknown / not set (pre-existing POs, non-GST transactions)

Note:
  Existing PO rows intentionally left NULL; a separate backfill script
  (scripts/backfill_po_place_of_supply.py) should be run once tax codes are
  migrated to the combined GST type. See KITERP GST remediation plan.
"""

from alembic import op
import sqlalchemy as sa


revision = "proc020_po_place_of_supply"
down_revision = "proc019_po_item_service_id"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "purchase_order",
        sa.Column("place_of_supply", sa.String(2), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("purchase_order", "place_of_supply")
