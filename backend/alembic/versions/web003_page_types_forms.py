"""web003 — ecommerce page types, form submissions, page revisions, draft scheduling

Adds:
  - wb_pages.publish_status, scheduled_publish_at (P2.3)
  - wb_form_submissions table (P1.4)
  - wb_page_revisions table (P2.2)
  - wb_sites.feature_flags JSON column
  - Default ecommerce pages auto-created by the publish handler (no DDL needed)

Revision ID: web003
Revises: web002
Create Date: 2026-04-24
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'web003'
down_revision = 'web002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── wb_pages: publish_status + scheduling ──────────────────────────────────
    op.add_column('wb_pages', sa.Column('publish_status', sa.String(20), server_default='published', nullable=True))
    # draft | scheduled | published
    op.add_column('wb_pages', sa.Column('scheduled_publish_at', sa.DateTime, nullable=True))

    # ── wb_sites: feature_flags ────────────────────────────────────────────────
    op.add_column('wb_sites', sa.Column('feature_flags', sa.JSON, nullable=True, server_default='{}'))

    # ── Form submissions ──────────────────────────────────────────────────────
    op.create_table(
        'wb_form_submissions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('site_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('wb_sites.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('page_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('wb_pages.id', ondelete='SET NULL'), nullable=True, index=True),
        sa.Column('block_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('form_type', sa.String(50), nullable=True),   # contact | newsletter | custom
        sa.Column('payload', sa.JSON, nullable=False, server_default='{}'),
        sa.Column('crm_lead_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('gdpr_consent', sa.Boolean, server_default='false'),
        sa.Column('ip_address', sa.String(64), nullable=True),
        sa.Column('user_agent', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime, server_default=sa.text('NOW()')),
    )

    # ── Page revisions ─────────────────────────────────────────────────────────
    op.create_table(
        'wb_page_revisions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('page_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('wb_pages.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('site_id', postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column('snapshot', sa.JSON, nullable=False, server_default='{}'),   # full page + blocks JSON
        sa.Column('author_user_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('note', sa.String(500), nullable=True),
        sa.Column('created_at', sa.DateTime, server_default=sa.text('NOW()')),
    )


def downgrade() -> None:
    op.drop_table('wb_page_revisions')
    op.drop_table('wb_form_submissions')
    op.drop_column('wb_sites', 'feature_flags')
    op.drop_column('wb_pages', 'scheduled_publish_at')
    op.drop_column('wb_pages', 'publish_status')
