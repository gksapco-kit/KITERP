"""Production orders table (MTO/MTS), store-scoped."""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision: str = "po001_production_orders"
down_revision: Union[str, None] = "hr006_employee_manager_id"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "production_order",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("vendor_id", UUID(as_uuid=True), sa.ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False),
        sa.Column("store_id", UUID(as_uuid=True), sa.ForeignKey("store.id", ondelete="SET NULL"), nullable=True),
        sa.Column("ref", sa.String(40), nullable=False),
        sa.Column("type", sa.String(10), nullable=False),
        sa.Column("template", sa.String(80), server_default="Standard"),
        sa.Column("status", sa.String(30), server_default="draft"),
        sa.Column("progress", sa.Integer(), server_default="0"),
        sa.Column("priority", sa.String(20), server_default="medium"),
        sa.Column("customer_id", UUID(as_uuid=True), sa.ForeignKey("customer.id", ondelete="SET NULL"), nullable=True),
        sa.Column("customer_name", sa.String(255)),
        sa.Column("customer_phone", sa.String(30)),
        sa.Column("customer_email", sa.String(255)),
        sa.Column("order_ref", sa.String(100)),
        sa.Column("delivery_deadline", sa.Date()),
        sa.Column("special_requirements", sa.Text()),
        sa.Column("target_stock_level", sa.Integer()),
        sa.Column("team", sa.String(120), server_default=""),
        sa.Column("target_date", sa.Date()),
        sa.Column("notes", sa.Text(), server_default=""),
        sa.Column("items", JSONB, nullable=False, server_default="[]"),
        sa.Column("assignees", JSONB, nullable=False, server_default="[]"),
        sa.Column("attachments", JSONB, nullable=False, server_default="[]"),
        sa.Column("stock_dispatches", JSONB, nullable=False, server_default="[]"),
        sa.Column("audit_log", JSONB, nullable=False, server_default="[]"),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("vendor_user.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_production_order_vendor_store", "production_order", ["vendor_id", "store_id"])
    op.create_index("ix_production_order_status", "production_order", ["vendor_id", "status"])
    op.create_unique_constraint("uq_production_order_vendor_ref", "production_order", ["vendor_id", "ref"])


def downgrade() -> None:
    op.drop_table("production_order")
