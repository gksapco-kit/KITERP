"""add booking invoice_id

Revision ID: b3c4d5e6f7a8
Revises: a2b3c4d5e6f7
Create Date: 2026-03-14

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = 'b3c4d5e6f7a8'
down_revision = 'a2b3c4d5e6f7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('booking', sa.Column('invoice_id', UUID(as_uuid=True), nullable=True))


def downgrade() -> None:
    op.drop_column('booking', 'invoice_id')
