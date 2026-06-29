"""merge heads before plant

Revision ID: d003_merge_before_plant
Revises: cat004_storefront_visible, crm006_template_settings, web008
Create Date: 2026-06-28

"""
from alembic import op

revision = 'd003_merge_before_plant'
down_revision = ('cat004_storefront_visible', 'crm006_template_settings', 'web008')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
