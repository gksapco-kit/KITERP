"""Add optional customer_id to pharma_complaint.

Revision ID: pharma009_complaint_customer
Revises: pharma008_bu_plant_region_scope
Create Date: 2026-07-30
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "pharma009_complaint_customer"
down_revision = "pharma008_bu_plant_region_scope"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "pharma_complaint",
        sa.Column(
            "customer_id",
            UUID(as_uuid=True),
            sa.ForeignKey("customer.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index("ix_pharma_complaint_customer", "pharma_complaint", ["customer_id"])


def downgrade() -> None:
    op.drop_index("ix_pharma_complaint_customer", table_name="pharma_complaint")
    op.drop_column("pharma_complaint", "customer_id")
