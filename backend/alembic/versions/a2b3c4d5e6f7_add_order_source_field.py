"""add order source field

Revision ID: a2b3c4d5e6f7
Revises: d7e8f9a0b1c2
Create Date: 2026-03-14

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = 'a2b3c4d5e6f7'
down_revision = 'f1a2b3c4d5e6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('order', sa.Column('source', sa.String(20), server_default='online', nullable=True))
    op.add_column('order', sa.Column('pos_transaction_id', UUID(as_uuid=True), nullable=True))
    op.create_index('ix_order_source', 'order', ['source'])


def downgrade() -> None:
    op.drop_index('ix_order_source', 'order')
    op.drop_column('order', 'pos_transaction_id')
    op.drop_column('order', 'source')
