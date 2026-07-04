"""Add venue_capacity to vendor_events (Maximum seats the venue can allot for an event)."""
from alembic import op
import sqlalchemy as sa

revision = "sales013_vendor_event_venue_capacity"
down_revision = "sales012_vendor_event_end_time"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("vendor_events", sa.Column("venue_capacity", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("vendor_events", "venue_capacity")
