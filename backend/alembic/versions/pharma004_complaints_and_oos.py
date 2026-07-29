"""Stage B: pharma_complaint table + OOS columns on pharma_inspection_lot.

Revision ID: pharma004_complaints_and_oos
Revises: pharma003_indexes_and_columns
Create Date: 2026-07-28

New in this migration:
  - pharma_complaint table (complaint lifecycle for customer/AE/defect intake)
  - pharma_inspection_lot.oos_status  (NULL | open | closed)
  - pharma_inspection_lot.oos_data    (JSONB investigation record)
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = "pharma004_complaints_and_oos"
down_revision = "pharma003_indexes_and_columns"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── pharma_complaint ──────────────────────────────────────────────────────
    op.create_table(
        "pharma_complaint",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("vendor_id", UUID(as_uuid=True),
                  sa.ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False),
        sa.Column("number", sa.String(60), nullable=False),
        sa.Column("complaint_type", sa.String(30), nullable=False, server_default="customer"),
        sa.Column("severity", sa.String(20), nullable=False, server_default="minor"),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("goods_batch_id", UUID(as_uuid=True),
                  sa.ForeignKey("goods_batch.id", ondelete="SET NULL"), nullable=True),
        sa.Column("reported_by", sa.String(255), nullable=True),
        sa.Column("status", sa.String(30), nullable=False, server_default="open"),
        sa.Column("investigation_notes", sa.Text, nullable=True),
        sa.Column("disposition", sa.String(255), nullable=True),
        sa.Column("created_by", UUID(as_uuid=True),
                  sa.ForeignKey("vendor_user.id", ondelete="SET NULL"), nullable=True),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.UniqueConstraint("vendor_id", "number", name="uq_pharma_complaint_number"),
    )
    op.create_index("ix_pharma_complaint_vendor", "pharma_complaint", ["vendor_id"])
    op.create_index("ix_pharma_complaint_status", "pharma_complaint", ["vendor_id", "status"])

    # ── OOS columns on pharma_inspection_lot ─────────────────────────────────
    op.add_column(
        "pharma_inspection_lot",
        sa.Column("oos_status", sa.String(20), nullable=True),  # NULL | open | closed
    )
    op.add_column(
        "pharma_inspection_lot",
        sa.Column("oos_data", JSONB, nullable=True),
    )


def downgrade() -> None:
    op.drop_column("pharma_inspection_lot", "oos_data")
    op.drop_column("pharma_inspection_lot", "oos_status")
    op.drop_index("ix_pharma_complaint_status", "pharma_complaint")
    op.drop_index("ix_pharma_complaint_vendor", "pharma_complaint")
    op.drop_table("pharma_complaint")
