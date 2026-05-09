"""add vendor order acceptance fields

Revision ID: d5e6f7a8b9c0
Revises: c4d5e6f7a8b9
Create Date: 2026-03-29 12:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'd5e6f7a8b9c0'
down_revision: Union[str, None] = 'c4d5e6f7a8b9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    cols = {c["name"] for c in insp.get_columns("vendor")}
    if "order_acceptance_enabled" not in cols:
        op.add_column('vendor', sa.Column('order_acceptance_enabled', sa.Boolean(), server_default=sa.text('true'), nullable=False))
    if "order_acceptance_hours" not in cols:
        op.add_column('vendor', sa.Column('order_acceptance_hours', postgresql.JSONB(), server_default=sa.text("'{}'::jsonb"), nullable=True))


def downgrade() -> None:
    op.drop_column('vendor', 'order_acceptance_hours')
    op.drop_column('vendor', 'order_acceptance_enabled')
