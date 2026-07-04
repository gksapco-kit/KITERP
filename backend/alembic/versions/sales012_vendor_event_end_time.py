"""Add end_time to vendor_events (Ticket Picker: show start–end time, not just doors/start)."""
from alembic import op
import sqlalchemy as sa

revision = "sales012_vendor_event_end_time"
down_revision = "sales011_booking_service_plan"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("vendor_events", sa.Column("end_time", sa.String(10), nullable=True))


def downgrade() -> None:
    op.drop_column("vendor_events", "end_time")
