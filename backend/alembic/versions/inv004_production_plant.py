"""add plant_id and output_storage_location_id to production_order

Revision ID: inv004_production_plant
Revises: inv003_plant
Create Date: 2026-06-28

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = 'inv004_production_plant'
down_revision = 'inv003_plant'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'production_order',
        sa.Column('plant_id', UUID(as_uuid=True), sa.ForeignKey('plant.id', ondelete='SET NULL'), nullable=True),
    )
    op.add_column(
        'production_order',
        sa.Column('output_storage_location_id', UUID(as_uuid=True), sa.ForeignKey('storage_location.id', ondelete='SET NULL'), nullable=True),
    )
    op.create_index('ix_production_order_plant', 'production_order', ['vendor_id', 'plant_id'])


def downgrade():
    op.drop_index('ix_production_order_plant', table_name='production_order')
    op.drop_column('production_order', 'output_storage_location_id')
    op.drop_column('production_order', 'plant_id')
