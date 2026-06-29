"""add geo_region, business_coverage, and user_territory tables

Revision ID: ter001_territory
Revises: bp000_merge_for_bp
Create Date: 2026-06-29

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = 'ter001_territory'
down_revision = 'bp000_merge_for_bp'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'geo_region',
        sa.Column('id', UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('vendor_id', UUID(as_uuid=True),
                  sa.ForeignKey('vendor.id', ondelete='CASCADE'), nullable=True),
        sa.Column('parent_id', UUID(as_uuid=True),
                  sa.ForeignKey('geo_region.id', ondelete='CASCADE'), nullable=True),
        sa.Column('level_type', sa.String(50), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('code', sa.String(50)),
        sa.Column('alternate_names', JSONB(), server_default='[]'),
        sa.Column('path', sa.Text()),
        sa.Column('latitude', sa.Numeric(10, 8)),
        sa.Column('longitude', sa.Numeric(11, 8)),
        sa.Column('boundary_geojson', JSONB()),
        sa.Column('attributes', JSONB(), server_default='{}'),
        sa.Column('sort_order', sa.Integer(), server_default='0'),
        sa.Column('is_active', sa.Boolean(), server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.UniqueConstraint('vendor_id', 'code', 'level_type', name='uq_geo_region_vendor_code_level'),
    )
    op.create_index('idx_geo_region_parent', 'geo_region', ['parent_id'])
    op.create_index('idx_geo_region_level', 'geo_region', ['level_type'])
    op.create_index('idx_geo_region_code', 'geo_region', ['code'])
    op.create_index('idx_geo_region_path', 'geo_region', ['path'])
    op.create_index('idx_geo_region_vendor', 'geo_region', ['vendor_id'])

    op.create_table(
        'business_coverage',
        sa.Column('id', UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('vendor_id', UUID(as_uuid=True),
                  sa.ForeignKey('vendor.id', ondelete='CASCADE'), nullable=False),
        sa.Column('owner_type', sa.String(50), nullable=False),
        sa.Column('owner_id', UUID(as_uuid=True), nullable=False),
        sa.Column('coverage_type', sa.String(20), nullable=False),
        sa.Column('geo_region_id', UUID(as_uuid=True),
                  sa.ForeignKey('geo_region.id', ondelete='SET NULL'), nullable=True),
        sa.Column('center_lat', sa.Numeric(10, 8)),
        sa.Column('center_lng', sa.Numeric(11, 8)),
        sa.Column('radius_km', sa.Numeric(10, 3)),
        sa.Column('polygon_geojson', JSONB()),
        sa.Column('is_include', sa.Boolean(), server_default='true'),
        sa.Column('priority', sa.Integer(), server_default='0'),
        sa.Column('effective_from', sa.DateTime(timezone=True)),
        sa.Column('effective_to', sa.DateTime(timezone=True)),
        sa.Column('attributes', JSONB(), server_default='{}'),
        sa.Column('is_active', sa.Boolean(), server_default='true'),
        sa.Column('created_by', UUID(as_uuid=True)),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )
    op.create_index('idx_bc_vendor', 'business_coverage', ['vendor_id'])
    op.create_index('idx_bc_owner', 'business_coverage', ['vendor_id', 'owner_type', 'owner_id'])
    op.create_index('idx_bc_region', 'business_coverage', ['geo_region_id'])
    op.create_index('idx_bc_active', 'business_coverage', ['vendor_id', 'is_active'])

    op.create_table(
        'user_territory',
        sa.Column('id', UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('vendor_id', UUID(as_uuid=True),
                  sa.ForeignKey('vendor.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', UUID(as_uuid=True),
                  sa.ForeignKey('vendor_user.id', ondelete='CASCADE'), nullable=False),
        sa.Column('geo_region_id', UUID(as_uuid=True),
                  sa.ForeignKey('geo_region.id', ondelete='CASCADE'), nullable=False),
        sa.Column('territory_role', sa.String(50), nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.UniqueConstraint(
            'vendor_id', 'user_id', 'geo_region_id', 'territory_role',
            name='uq_user_territory',
        ),
    )
    op.create_index('idx_ut_vendor_user', 'user_territory', ['vendor_id', 'user_id'])
    op.create_index('idx_ut_region', 'user_territory', ['geo_region_id'])


def downgrade():
    op.drop_index('idx_ut_region', table_name='user_territory')
    op.drop_index('idx_ut_vendor_user', table_name='user_territory')
    op.drop_table('user_territory')

    op.drop_index('idx_bc_active', table_name='business_coverage')
    op.drop_index('idx_bc_region', table_name='business_coverage')
    op.drop_index('idx_bc_owner', table_name='business_coverage')
    op.drop_index('idx_bc_vendor', table_name='business_coverage')
    op.drop_table('business_coverage')

    op.drop_index('idx_geo_region_vendor', table_name='geo_region')
    op.drop_index('idx_geo_region_path', table_name='geo_region')
    op.drop_index('idx_geo_region_code', table_name='geo_region')
    op.drop_index('idx_geo_region_level', table_name='geo_region')
    op.drop_index('idx_geo_region_parent', table_name='geo_region')
    op.drop_table('geo_region')
