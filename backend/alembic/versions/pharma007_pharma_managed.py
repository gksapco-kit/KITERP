"""Add pharma_managed flag to product — enrollment gate for pharma manufacturing.

Revision ID: pharma007_pharma_managed
Revises: pharma006_approval_rules
Create Date: 2026-07-29
"""
from alembic import op
import sqlalchemy as sa

revision = "pharma007_pharma_managed"
down_revision = "pharma006_approval_rules"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "product",
        sa.Column(
            "pharma_managed",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    # Back-fill: any product that already has batch or serial flags set is
    # implicitly enrolled in pharma manufacturing.
    op.execute(
        """
        UPDATE product
        SET pharma_managed = true
        WHERE batch_managed = true OR serial_managed = true
        """
    )


def downgrade() -> None:
    op.drop_column("product", "pharma_managed")
