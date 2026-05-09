"""co005 – work centres, routings, routing operations; extend overhead pool & product cost version

Revision ID: co005
Revises: co004
Create Date: 2026-04-23
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'co005'
down_revision = 'co004_controlling_extended'
branch_labels = None
depends_on = None


def upgrade():
    # ── Extend co_overhead_pool ──────────────────────────────────────────────
    op.add_column('co_overhead_pool', sa.Column('overhead_type', sa.String(20), server_default='indirect', nullable=False))
    op.add_column('co_overhead_pool', sa.Column('formula_type', sa.String(30), server_default='fixed_rate', nullable=False))
    op.add_column('co_overhead_pool', sa.Column('formula_value', sa.Numeric(18, 6), server_default='0', nullable=False))

    # ── co_work_center ───────────────────────────────────────────────────────
    op.create_table(
        'co_work_center',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('vendor_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('vendor.id', ondelete='CASCADE'), nullable=False),
        sa.Column('company_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('fin_company.id', ondelete='CASCADE'), nullable=False),
        sa.Column('code', sa.String(50), nullable=False),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('description', sa.Text),
        sa.Column('wc_type', sa.String(20), server_default='machine', nullable=False),
        sa.Column('capacity_uom', sa.String(10), server_default='H', nullable=False),
        sa.Column('labor_rate_per_hour', sa.Numeric(18, 6), server_default='0'),
        sa.Column('machine_rate_per_hour', sa.Numeric(18, 6), server_default='0'),
        sa.Column('direct_overhead_rate', sa.Numeric(18, 6), server_default='0'),
        sa.Column('capacity_hours_per_period', sa.Numeric(10, 2), server_default='0'),
        sa.Column('cost_center_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('fin_cost_center.id', ondelete='SET NULL'), nullable=True),
        sa.Column('is_active', sa.Boolean, server_default='true', nullable=False),
        sa.Column('notes', sa.Text),
        sa.Column('extra', postgresql.JSONB, server_default='{}'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.UniqueConstraint('company_id', 'code', name='uq_co_wc_company_code'),
    )
    op.create_index('ix_co_wc_company', 'co_work_center', ['company_id', 'is_active'])
    op.create_index('ix_co_wc_vendor', 'co_work_center', ['vendor_id'])

    # ── co_routing ───────────────────────────────────────────────────────────
    op.create_table(
        'co_routing',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('vendor_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('vendor.id', ondelete='CASCADE'), nullable=False),
        sa.Column('company_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('fin_company.id', ondelete='CASCADE'), nullable=False),
        sa.Column('product_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('product.id', ondelete='SET NULL'), nullable=True),
        sa.Column('code', sa.String(50), nullable=False),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('version', sa.String(20), server_default='1', nullable=False),
        sa.Column('status', sa.String(20), server_default='draft', nullable=False),
        sa.Column('valid_from', sa.Date, nullable=True),
        sa.Column('valid_to', sa.Date, nullable=True),
        sa.Column('uom', sa.String(10), server_default='EA', nullable=False),
        sa.Column('lot_size', sa.Numeric(18, 4), server_default='1'),
        sa.Column('notes', sa.Text),
        sa.Column('extra', postgresql.JSONB, server_default='{}'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.UniqueConstraint('company_id', 'code', 'version', name='uq_co_routing_code_ver'),
    )
    op.create_index('ix_co_routing_product', 'co_routing', ['company_id', 'product_id'])
    op.create_index('ix_co_routing_vendor', 'co_routing', ['vendor_id'])

    # ── co_routing_operation ─────────────────────────────────────────────────
    op.create_table(
        'co_routing_operation',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('routing_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('co_routing.id', ondelete='CASCADE'), nullable=False),
        sa.Column('work_center_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('co_work_center.id', ondelete='SET NULL'), nullable=True),
        sa.Column('activity_type_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('co_activity_type.id', ondelete='SET NULL'), nullable=True),
        sa.Column('seq_no', sa.Integer, server_default='10', nullable=False),
        sa.Column('operation_code', sa.String(50)),
        sa.Column('description', sa.String(200)),
        sa.Column('setup_hrs', sa.Numeric(10, 4), server_default='0'),
        sa.Column('run_hrs_per_unit', sa.Numeric(10, 6), server_default='0'),
        sa.Column('teardown_hrs', sa.Numeric(10, 4), server_default='0'),
        sa.Column('machine_hrs_per_unit', sa.Numeric(10, 6), server_default='0'),
        sa.Column('labor_rate_override', sa.Numeric(18, 6), nullable=True),
        sa.Column('machine_rate_override', sa.Numeric(18, 6), nullable=True),
        sa.Column('direct_overhead_pct', sa.Numeric(7, 4), server_default='0'),
        sa.Column('notes', sa.Text),
        sa.Column('extra', postgresql.JSONB, server_default='{}'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )
    op.create_index('ix_co_rop_routing', 'co_routing_operation', ['routing_id'])
    op.create_index('ix_co_rop_wc', 'co_routing_operation', ['work_center_id'])

    # ── Extend co_product_cost_version ───────────────────────────────────────
    op.add_column('co_product_cost_version', sa.Column(
        'routing_id', postgresql.UUID(as_uuid=True),
        sa.ForeignKey('co_routing.id', ondelete='SET NULL'), nullable=True,
    ))
    op.add_column('co_product_cost_version', sa.Column(
        'direct_overhead_total_planned', sa.Numeric(18, 4), server_default='0',
    ))
    op.add_column('co_product_cost_version', sa.Column(
        'indirect_overhead_total_planned', sa.Numeric(18, 4), server_default='0',
    ))


def downgrade():
    op.drop_column('co_product_cost_version', 'indirect_overhead_total_planned')
    op.drop_column('co_product_cost_version', 'direct_overhead_total_planned')
    op.drop_column('co_product_cost_version', 'routing_id')

    op.drop_index('ix_co_rop_wc', table_name='co_routing_operation')
    op.drop_index('ix_co_rop_routing', table_name='co_routing_operation')
    op.drop_table('co_routing_operation')

    op.drop_index('ix_co_routing_vendor', table_name='co_routing')
    op.drop_index('ix_co_routing_product', table_name='co_routing')
    op.drop_table('co_routing')

    op.drop_index('ix_co_wc_vendor', table_name='co_work_center')
    op.drop_index('ix_co_wc_company', table_name='co_work_center')
    op.drop_table('co_work_center')

    op.drop_column('co_overhead_pool', 'formula_value')
    op.drop_column('co_overhead_pool', 'formula_type')
    op.drop_column('co_overhead_pool', 'overhead_type')
