"""Add payment_proof JSONB to order for manual UPI verification."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "order001_payment_proof"
down_revision = "rest001_restaurant_base_tables"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("order", sa.Column("payment_proof", JSONB, nullable=True))


def downgrade() -> None:
    op.drop_column("order", "payment_proof")
