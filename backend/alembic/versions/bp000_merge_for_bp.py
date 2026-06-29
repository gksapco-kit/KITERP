"""merge fin016b and proc001 before business partner

Revision ID: bp000_merge_for_bp
Revises: fin016b_fix_vendor_fkeys, proc001_full_procurement
Create Date: 2026-06-28

"""
from alembic import op

revision = 'bp000_merge_for_bp'
down_revision = ('fin016b_fix_vendor_fkeys', 'proc001_full_procurement')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
