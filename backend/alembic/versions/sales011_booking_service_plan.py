"""Add service_plan_id + plan_name to booking (select which plan/variant to book)."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "sales011_booking_service_plan"
down_revision = "sales010_vendor_booking_resources"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "booking",
        sa.Column("service_plan_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("service_plan.id", ondelete="SET NULL"), nullable=True),
    )
    op.add_column("booking", sa.Column("plan_name", sa.String(255), nullable=True))
    op.create_index("ix_booking_service_plan_id", "booking", ["service_plan_id"])


def downgrade() -> None:
    op.drop_index("ix_booking_service_plan_id", table_name="booking")
    op.drop_column("booking", "plan_name")
    op.drop_column("booking", "service_plan_id")
