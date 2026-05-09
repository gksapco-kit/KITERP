"""add subscription_schedule_modes to product_variant

Revision ID: x5g6h7i8j9k0
Revises: w4f5g6h7i8j9
Create Date: 2026-04-10

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "x5g6h7i8j9k0"
down_revision = "w4f5g6h7i8j9"
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.add_column(
        "product_variant",
        sa.Column(
            "subscription_schedule_modes",
            JSONB,
            server_default=sa.text("""'["dates","cycles","pick_dates","weekly","recurring"]'::jsonb"""),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("product_variant", "subscription_schedule_modes")
