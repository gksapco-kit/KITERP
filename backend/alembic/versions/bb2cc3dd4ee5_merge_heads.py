"""merge multiple heads into single branch

Revision ID: bb2cc3dd4ee5
Revises: aa1bb2cc3dd4, b2c3d4e5f6g7
Create Date: 2026-04-14

"""
from alembic import op
import sqlalchemy as sa

revision = "bb2cc3dd4ee5"
down_revision = ("aa1bb2cc3dd4", "b2c3d4e5f6g7")
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
