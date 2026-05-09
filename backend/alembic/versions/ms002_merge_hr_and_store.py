"""merge hr001 and ms001 heads

Revision ID: ms002_merge_hr_and_store
Revises: hr001_add_hr_tables, ms001_add_multi_store
Create Date: 2026-04-15

"""
from alembic import op

revision = 'ms002_merge_hr_and_store'
down_revision = ('hr001_add_hr_tables', 'ms001_add_multi_store')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
