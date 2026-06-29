"""service BOM and resource planning tables

Revision ID: svc001_service_bom_resources
Revises: bp001_business_partner
Create Date: 2026-06-29

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = 'svc001_service_bom_resources'
down_revision = 'bp001_business_partner'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'service_bom_item',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('vendor_id', UUID(as_uuid=True), sa.ForeignKey('vendor.id', ondelete='CASCADE'), nullable=False),
        sa.Column('service_id', UUID(as_uuid=True), sa.ForeignKey('service.id', ondelete='CASCADE'), nullable=False),
        sa.Column('component_id', UUID(as_uuid=True), sa.ForeignKey('product.id', ondelete='CASCADE'), nullable=False),
        sa.Column('qty_per_service', sa.Numeric(12, 4), nullable=False),
        sa.Column('unit_cost_override', sa.Numeric(12, 4), nullable=True),
        sa.Column('auto_reserve', sa.Boolean(), server_default='true'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('idx_svc_bom_vendor', 'service_bom_item', ['vendor_id'])
    op.create_index('idx_svc_bom_service', 'service_bom_item', ['service_id'])
    op.create_index('idx_svc_bom_component', 'service_bom_item', ['component_id'])

    op.create_table(
        'service_resource',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('vendor_id', UUID(as_uuid=True), sa.ForeignKey('vendor.id', ondelete='CASCADE'), nullable=False),
        sa.Column('service_id', UUID(as_uuid=True), sa.ForeignKey('service.id', ondelete='CASCADE'), nullable=False),
        sa.Column('resource_type', sa.String(30), nullable=False, server_default='employee'),
        sa.Column('resource_id', UUID(as_uuid=True), nullable=True),
        sa.Column('resource_name', sa.String(255), nullable=False),
        sa.Column('quantity', sa.Numeric(8, 2), server_default='1'),
        sa.Column('duration_minutes', sa.Integer(), nullable=True),
        sa.Column('cost_type', sa.String(20), server_default='hourly'),
        sa.Column('cost_rate', sa.Numeric(12, 4), server_default='0'),
        sa.Column('auto_reserve', sa.Boolean(), server_default='true'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('sort_order', sa.Integer(), server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('idx_svc_res_vendor', 'service_resource', ['vendor_id'])
    op.create_index('idx_svc_res_service', 'service_resource', ['service_id'])
    op.create_index('idx_svc_res_type', 'service_resource', ['resource_type'])


def downgrade():
    op.drop_index('idx_svc_res_type', 'service_resource')
    op.drop_index('idx_svc_res_service', 'service_resource')
    op.drop_index('idx_svc_res_vendor', 'service_resource')
    op.drop_table('service_resource')
    op.drop_index('idx_svc_bom_component', 'service_bom_item')
    op.drop_index('idx_svc_bom_service', 'service_bom_item')
    op.drop_index('idx_svc_bom_vendor', 'service_bom_item')
    op.drop_table('service_bom_item')
