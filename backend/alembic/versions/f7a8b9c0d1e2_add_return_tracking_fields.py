"""add return tracking fields

Revision ID: f7a8b9c0d1e2
Revises: e6f7a8b9c0d1
Create Date: 2026-03-29 13:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'f7a8b9c0d1e2'
down_revision: Union[str, None] = 'e6f7a8b9c0d1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('order', sa.Column('return_tracking_number', sa.String(100), nullable=True))
    op.add_column('order', sa.Column('return_tracking_url', sa.String(500), nullable=True))


def downgrade() -> None:
    op.drop_column('order', 'return_tracking_url')
    op.drop_column('order', 'return_tracking_number')
