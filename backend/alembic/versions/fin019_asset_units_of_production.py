"""fixed asset units-of-production depreciation support

Revision ID: fin019_asset_units_of_production
Revises: svc001_service_bom_resources
Create Date: 2026-07-02

"""
from alembic import op
import sqlalchemy as sa

revision = 'fin019_asset_units_of_production'
down_revision = 'svc001_service_bom_resources'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('fin_asset', sa.Column('total_units_capacity', sa.Numeric(18, 4), nullable=True))
    op.add_column('fin_asset', sa.Column('units_consumed', sa.Numeric(18, 4), server_default='0'))
    op.add_column('fin_asset_depreciation_entry', sa.Column('units_produced', sa.Numeric(18, 4), nullable=True))


def downgrade():
    op.drop_column('fin_asset_depreciation_entry', 'units_produced')
    op.drop_column('fin_asset', 'units_consumed')
    op.drop_column('fin_asset', 'total_units_capacity')
