"""add party_type to supplier table

Revision ID: b2c3d4e5f6g7
Revises: a1g2s3t4p5b6
Create Date: 2026-04-11

"""
from alembic import op
import sqlalchemy as sa

revision = "b2c3d4e5f6g7"
down_revision = "a1g2s3t4p5b6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "supplier",
        sa.Column(
            "party_type",
            sa.String(20),
            nullable=False,
            server_default="supplier",
        ),
    )


def downgrade() -> None:
    op.drop_column("supplier", "party_type")
