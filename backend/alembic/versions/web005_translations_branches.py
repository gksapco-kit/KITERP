"""web005 — block-level translations + visible_branches + wb_symbols

Revision ID: web005
Revises: web004
Create Date: 2026-04-24
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'web005'
down_revision = 'web004'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Block translations ─────────────────────────────────────────────────────
    op.create_table(
        'wb_block_translations',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('block_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('wb_blocks.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('language', sa.String(10), nullable=False),   # ISO 639-1 e.g. 'en', 'hi', 'ar'
        sa.Column('props_override', sa.JSON, nullable=False, server_default='{}'),
        sa.Column('created_at', sa.DateTime, server_default=sa.text('NOW()')),
        sa.Column('updated_at', sa.DateTime, server_default=sa.text('NOW()')),
        sa.UniqueConstraint('block_id', 'language', name='uq_block_lang'),
    )

    # ── Branch-scoped visibility on blocks ─────────────────────────────────────
    op.add_column('wb_blocks', sa.Column('visible_branches', sa.JSON, nullable=True))

    # ── Symbols / reusable block subtrees ─────────────────────────────────────
    op.create_table(
        'wb_symbols',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('vendor_id', postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('snapshot', sa.JSON, nullable=False, server_default='{}'),  # block tree JSON
        sa.Column('thumbnail_url', sa.String(500), nullable=True),
        sa.Column('created_at', sa.DateTime, server_default=sa.text('NOW()')),
        sa.Column('updated_at', sa.DateTime, server_default=sa.text('NOW()')),
    )

    # ── A/B Test exposures ────────────────────────────────────────────────────
    op.create_table(
        'wb_ab_exposures',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('site_id', postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column('block_id', postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column('variant', sa.String(10), nullable=False),   # 'a' | 'b'
        sa.Column('session_id', sa.String(100), nullable=True),
        sa.Column('converted', sa.Boolean, server_default='false'),
        sa.Column('created_at', sa.DateTime, server_default=sa.text('NOW()')),
    )

    # ── Outgoing webhooks ─────────────────────────────────────────────────────
    op.create_table(
        'wb_webhooks',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('site_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('wb_sites.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('event', sa.String(50), nullable=False),
        sa.Column('url', sa.String(500), nullable=False),
        sa.Column('secret', sa.String(64), nullable=True),
        sa.Column('is_active', sa.Boolean, server_default='true'),
        sa.Column('last_triggered_at', sa.DateTime, nullable=True),
        sa.Column('last_status_code', sa.Integer, nullable=True),
        sa.Column('created_at', sa.DateTime, server_default=sa.text('NOW()')),
    )


def downgrade() -> None:
    op.drop_table('wb_webhooks')
    op.drop_table('wb_ab_exposures')
    op.drop_table('wb_symbols')
    op.drop_column('wb_blocks', 'visible_branches')
    op.drop_table('wb_block_translations')
