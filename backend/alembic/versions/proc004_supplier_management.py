"""Procurement Phase 1: extended supplier management

Revision ID: proc004_supplier_management
Revises: proc003_doc_sequences
Create Date: 2026-09-01

Adds:
  supplier_category         – spend / commodity classification hierarchy
  supplier_category_link    – M:M supplier ↔ category
  supplier_contact          – multiple named contacts per supplier
  supplier_address          – multiple typed addresses per supplier
  supplier_document         – compliance docs with expiry tracking
  supplier_onboarding       – qualification / approval workflow
  supplier_performance      – periodic KPI scorecard
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = 'proc004_supplier_management'
down_revision = 'proc003_doc_sequences'
branch_labels = None
depends_on = None


def upgrade():
    # ── supplier_category ────────────────────────────────────────
    op.create_table(
        'supplier_category',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('vendor_id', UUID(as_uuid=True),
                  sa.ForeignKey('vendor.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(120), nullable=False),
        sa.Column('code', sa.String(30), nullable=True),
        sa.Column('parent_id', UUID(as_uuid=True),
                  sa.ForeignKey('supplier_category.id', ondelete='SET NULL'), nullable=True),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('is_active', sa.Boolean, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint('vendor_id', 'name', name='uq_supplier_cat_vendor_name'),
    )
    op.create_index('ix_supplier_cat_vendor', 'supplier_category', ['vendor_id'])

    # ── supplier_category_link ───────────────────────────────────
    op.create_table(
        'supplier_category_link',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('supplier_id', UUID(as_uuid=True),
                  sa.ForeignKey('supplier.id', ondelete='CASCADE'), nullable=False),
        sa.Column('category_id', UUID(as_uuid=True),
                  sa.ForeignKey('supplier_category.id', ondelete='CASCADE'), nullable=False),
        sa.UniqueConstraint('supplier_id', 'category_id', name='uq_supplier_cat_link'),
    )
    op.create_index('ix_supcatlink_supplier', 'supplier_category_link', ['supplier_id'])
    op.create_index('ix_supcatlink_category', 'supplier_category_link', ['category_id'])

    # ── supplier_contact ─────────────────────────────────────────
    op.create_table(
        'supplier_contact',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('vendor_id', UUID(as_uuid=True),
                  sa.ForeignKey('vendor.id', ondelete='CASCADE'), nullable=False),
        sa.Column('supplier_id', UUID(as_uuid=True),
                  sa.ForeignKey('supplier.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('designation', sa.String(120), nullable=True),
        sa.Column('department', sa.String(100), nullable=True),
        sa.Column('email', sa.String(255), nullable=True),
        sa.Column('phone', sa.String(30), nullable=True),
        sa.Column('mobile', sa.String(30), nullable=True),
        sa.Column('is_primary', sa.Boolean, server_default='false'),
        sa.Column('notes', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_supcontact_supplier', 'supplier_contact', ['supplier_id'])
    op.create_index('ix_supcontact_vendor', 'supplier_contact', ['vendor_id'])

    # ── supplier_address ─────────────────────────────────────────
    op.create_table(
        'supplier_address',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('vendor_id', UUID(as_uuid=True),
                  sa.ForeignKey('vendor.id', ondelete='CASCADE'), nullable=False),
        sa.Column('supplier_id', UUID(as_uuid=True),
                  sa.ForeignKey('supplier.id', ondelete='CASCADE'), nullable=False),
        sa.Column('address_type', sa.String(30), server_default='billing', nullable=False),
        sa.Column('line1', sa.String(255), nullable=False),
        sa.Column('line2', sa.String(255), nullable=True),
        sa.Column('city', sa.String(100), nullable=True),
        sa.Column('state', sa.String(100), nullable=True),
        sa.Column('pincode', sa.String(20), nullable=True),
        sa.Column('country', sa.String(60), server_default='India', nullable=False),
        sa.Column('gstin', sa.String(15), nullable=True),
        sa.Column('is_default', sa.Boolean, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_supaddr_supplier', 'supplier_address', ['supplier_id'])
    op.create_index('ix_supaddr_vendor', 'supplier_address', ['vendor_id'])

    # ── supplier_document ────────────────────────────────────────
    op.create_table(
        'supplier_document',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('vendor_id', UUID(as_uuid=True),
                  sa.ForeignKey('vendor.id', ondelete='CASCADE'), nullable=False),
        sa.Column('supplier_id', UUID(as_uuid=True),
                  sa.ForeignKey('supplier.id', ondelete='CASCADE'), nullable=False),
        sa.Column('document_type', sa.String(60), nullable=False),
        sa.Column('document_number', sa.String(100), nullable=True),
        sa.Column('file_url', sa.String(500), nullable=True),
        sa.Column('file_name', sa.String(255), nullable=True),
        sa.Column('issue_date', sa.Date, nullable=True),
        sa.Column('expiry_date', sa.Date, nullable=True),
        sa.Column('issuing_authority', sa.String(200), nullable=True),
        sa.Column('status', sa.String(30), server_default='pending_verification', nullable=False),
        sa.Column('verified_by', UUID(as_uuid=True),
                  sa.ForeignKey('vendor_user.id', ondelete='SET NULL'), nullable=True),
        sa.Column('verified_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('rejection_reason', sa.Text, nullable=True),
        sa.Column('notes', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_supdoc_supplier', 'supplier_document', ['supplier_id'])
    op.create_index('ix_supdoc_vendor', 'supplier_document', ['vendor_id'])
    op.create_index('ix_supdoc_expiry', 'supplier_document', ['expiry_date'])
    op.create_index('ix_supdoc_status', 'supplier_document', ['vendor_id', 'status'])

    # ── supplier_onboarding ──────────────────────────────────────
    op.create_table(
        'supplier_onboarding',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('vendor_id', UUID(as_uuid=True),
                  sa.ForeignKey('vendor.id', ondelete='CASCADE'), nullable=False),
        sa.Column('supplier_id', UUID(as_uuid=True),
                  sa.ForeignKey('supplier.id', ondelete='CASCADE'), nullable=False, unique=True),
        sa.Column('status', sa.String(30), server_default='draft', nullable=False),
        sa.Column('qualification_score', sa.Numeric(5, 2), nullable=True),
        sa.Column('payment_terms', sa.String(50), nullable=True),
        sa.Column('credit_limit', sa.Numeric(14, 2), nullable=True),
        sa.Column('currency', sa.String(3), server_default='INR'),
        sa.Column('checklist', JSONB, server_default='[]'),
        sa.Column('reviewed_by', UUID(as_uuid=True),
                  sa.ForeignKey('vendor_user.id', ondelete='SET NULL'), nullable=True),
        sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('rejection_reason', sa.Text, nullable=True),
        sa.Column('internal_notes', sa.Text, nullable=True),
        sa.Column('approved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('re_evaluation_due', sa.Date, nullable=True),
        sa.Column('audit_log', JSONB, server_default='[]'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_sup_onboard_vendor', 'supplier_onboarding', ['vendor_id'])
    op.create_index('ix_sup_onboard_status', 'supplier_onboarding', ['vendor_id', 'status'])

    # ── supplier_performance ─────────────────────────────────────
    op.create_table(
        'supplier_performance',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('vendor_id', UUID(as_uuid=True),
                  sa.ForeignKey('vendor.id', ondelete='CASCADE'), nullable=False),
        sa.Column('supplier_id', UUID(as_uuid=True),
                  sa.ForeignKey('supplier.id', ondelete='CASCADE'), nullable=False),
        sa.Column('period_type', sa.String(20), server_default='monthly', nullable=False),
        sa.Column('period_start', sa.Date, nullable=False),
        sa.Column('period_end', sa.Date, nullable=False),
        sa.Column('po_count', sa.Integer, server_default='0'),
        sa.Column('on_time_delivery_pct', sa.Numeric(6, 2), nullable=True),
        sa.Column('quality_acceptance_pct', sa.Numeric(6, 2), nullable=True),
        sa.Column('price_variance_pct', sa.Numeric(7, 2), nullable=True),
        sa.Column('response_time_days', sa.Numeric(6, 1), nullable=True),
        sa.Column('overall_score', sa.Numeric(5, 2), nullable=True),
        sa.Column('weight_delivery', sa.Numeric(5, 2), server_default='40'),
        sa.Column('weight_quality', sa.Numeric(5, 2), server_default='35'),
        sa.Column('weight_price', sa.Numeric(5, 2), server_default='15'),
        sa.Column('weight_response', sa.Numeric(5, 2), server_default='10'),
        sa.Column('comments', sa.Text, nullable=True),
        sa.Column('computed_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint('supplier_id', 'period_start', 'period_end',
                            name='uq_supplier_perf_period'),
    )
    op.create_index('ix_supperf_vendor', 'supplier_performance', ['vendor_id'])
    op.create_index('ix_supperf_supplier', 'supplier_performance', ['supplier_id'])
    op.create_index('ix_supperf_period', 'supplier_performance', ['vendor_id', 'period_start'])


def downgrade():
    op.drop_table('supplier_performance')
    op.drop_table('supplier_onboarding')
    op.drop_table('supplier_document')
    op.drop_table('supplier_address')
    op.drop_table('supplier_contact')
    op.drop_table('supplier_category_link')
    op.drop_table('supplier_category')
