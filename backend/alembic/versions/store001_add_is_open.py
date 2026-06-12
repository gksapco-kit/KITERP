"""add is_open column to store table

Revision ID: store001_add_is_open
Revises: dom002_ext_domain_dns, inv002_storage_location_inventory
Create Date: 2026-06-13

"""
from alembic import op
import sqlalchemy as sa

revision = 'store001_add_is_open'
down_revision = ('dom002_ext_domain_dns', 'inv002_storage_location_inventory')
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'store',
        sa.Column('is_open', sa.Boolean(), nullable=False, server_default=sa.true()),
    )


def downgrade() -> None:
    op.drop_column('store', 'is_open')
