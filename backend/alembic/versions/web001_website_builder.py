"""web001 website builder tables

Revision ID: web001
Revises:
Create Date: 2026-04-23
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'web001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'wb_sites',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('vendor_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('vendor.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('subdomain', sa.String(100), nullable=True, unique=True),
        sa.Column('custom_domain', sa.String(255), nullable=True),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('favicon_url', sa.String(500), nullable=True),
        sa.Column('logo_url', sa.String(500), nullable=True),
        sa.Column('style_config', sa.JSON, nullable=False, server_default='{}'),
        sa.Column('seo_title', sa.String(200), nullable=True),
        sa.Column('seo_description', sa.Text, nullable=True),
        sa.Column('seo_keywords', sa.String(500), nullable=True),
        sa.Column('og_image_url', sa.String(500), nullable=True),
        sa.Column('is_published', sa.Boolean, server_default='false'),
        sa.Column('published_at', sa.DateTime, nullable=True),
        sa.Column('status', sa.String(50), server_default='draft'),
        sa.Column('google_analytics_id', sa.String(50), nullable=True),
        sa.Column('meta_pixel_id', sa.String(50), nullable=True),
        sa.Column('custom_head_code', sa.Text, nullable=True),
        sa.Column('custom_body_code', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime, server_default=sa.text('now()')),
    )

    op.create_table(
        'wb_pages',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('site_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('wb_sites.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('title', sa.String(200), nullable=False),
        sa.Column('slug', sa.String(200), nullable=False),
        sa.Column('page_type', sa.String(50), server_default='custom'),
        sa.Column('seo_title', sa.String(200), nullable=True),
        sa.Column('seo_description', sa.Text, nullable=True),
        sa.Column('og_image_url', sa.String(500), nullable=True),
        sa.Column('layout', sa.String(50), server_default='full'),
        sa.Column('sort_order', sa.Integer, server_default='0'),
        sa.Column('is_published', sa.Boolean, server_default='true'),
        sa.Column('is_homepage', sa.Boolean, server_default='false'),
        sa.Column('show_in_nav', sa.Boolean, server_default='true'),
        sa.Column('created_at', sa.DateTime, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime, server_default=sa.text('now()')),
    )

    op.create_table(
        'wb_blocks',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('page_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('wb_pages.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('block_type', sa.String(100), nullable=False),
        sa.Column('label', sa.String(200), nullable=True),
        sa.Column('props', sa.JSON, nullable=False, server_default='{}'),
        sa.Column('style_overrides', sa.JSON, nullable=False, server_default='{}'),
        sa.Column('visible', sa.Boolean, server_default='true'),
        sa.Column('visible_on_mobile', sa.Boolean, server_default='true'),
        sa.Column('visible_on_tablet', sa.Boolean, server_default='true'),
        sa.Column('visible_on_desktop', sa.Boolean, server_default='true'),
        sa.Column('animation', sa.String(50), nullable=True),
        sa.Column('animation_delay', sa.Integer, server_default='0'),
        sa.Column('sort_order', sa.Integer, server_default='0'),
        sa.Column('created_at', sa.DateTime, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime, server_default=sa.text('now()')),
    )

    op.create_table(
        'wb_media',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('site_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('wb_sites.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('vendor_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('vendor.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('filename', sa.String(300), nullable=False),
        sa.Column('original_url', sa.String(500), nullable=False),
        sa.Column('adjusted_url', sa.String(500), nullable=True),
        sa.Column('thumbnail_url', sa.String(500), nullable=True),
        sa.Column('file_type', sa.String(50), nullable=True),
        sa.Column('width', sa.Integer, nullable=True),
        sa.Column('height', sa.Integer, nullable=True),
        sa.Column('file_size', sa.Integer, nullable=True),
        sa.Column('adjustments', sa.JSON, nullable=False, server_default='{}'),
        sa.Column('ai_tags', sa.JSON, nullable=False, server_default='[]'),
        sa.Column('ai_description', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime, server_default=sa.text('now()')),
    )


def downgrade() -> None:
    op.drop_table('wb_media')
    op.drop_table('wb_blocks')
    op.drop_table('wb_pages')
    op.drop_table('wb_sites')
