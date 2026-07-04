"""Add vendor_booking_wizard_steps table for Booking Wizard step sync."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "sales009_vendor_booking_wizard_steps"
down_revision = "sales008_vendor_testimonials"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "vendor_booking_wizard_steps",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("vendor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False),
        sa.Column("label", sa.String(160), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("idx_vendor_booking_wizard_steps_vendor", "vendor_booking_wizard_steps", ["vendor_id"])


def downgrade() -> None:
    op.drop_index("idx_vendor_booking_wizard_steps_vendor", table_name="vendor_booking_wizard_steps")
    op.drop_table("vendor_booking_wizard_steps")
