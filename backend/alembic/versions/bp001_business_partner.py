"""add business_partner and business_partner_role tables

Revision ID: bp001_business_partner
Revises: bp000_merge_for_bp
Create Date: 2026-06-28

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = 'bp001_business_partner'
down_revision = 'bp000_merge_for_bp'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'business_partner',
        sa.Column('id', UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('vendor_id', UUID(as_uuid=True),
                  sa.ForeignKey('vendor.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('contact_name', sa.String(255)),
        sa.Column('email', sa.String(255)),
        sa.Column('phone', sa.String(30)),
        sa.Column('gstin', sa.String(15)),
        sa.Column('pan_number', sa.String(10)),
        sa.Column('cin', sa.String(21)),
        sa.Column('company_name', sa.String(255)),
        sa.Column('address', JSONB(), server_default='{}'),
        sa.Column('addresses', JSONB(), server_default='[]'),
        sa.Column('bank_name', sa.String(100)),
        sa.Column('account_number', sa.String(30)),
        sa.Column('account_holder_name', sa.String(255)),
        sa.Column('account_type', sa.String(20), server_default='savings'),
        sa.Column('ifsc_code', sa.String(15)),
        sa.Column('opening_balance', sa.Numeric(12, 2), server_default='0'),
        sa.Column('notes', sa.Text()),
        sa.Column('avatar_url', sa.String(500)),
        sa.Column('is_active', sa.Boolean(), server_default='true'),
        sa.Column('party_status', sa.String(20), server_default='active'),
        sa.Column('payment_blocked', sa.Boolean(), server_default='false'),
        sa.Column('hold_until', sa.DateTime(timezone=True)),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )
    op.create_index('ix_bp_vendor', 'business_partner', ['vendor_id'])
    op.create_index('ix_bp_vendor_name', 'business_partner', ['vendor_id', 'name'])
    op.create_index('ix_bp_vendor_gstin', 'business_partner', ['vendor_id', 'gstin'])
    op.create_index('ix_bp_vendor_phone', 'business_partner', ['vendor_id', 'phone'])
    op.create_index('ix_bp_vendor_email', 'business_partner', ['vendor_id', 'email'])

    op.create_table(
        'business_partner_role',
        sa.Column('id', UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('vendor_id', UUID(as_uuid=True),
                  sa.ForeignKey('vendor.id', ondelete='CASCADE'), nullable=False),
        sa.Column('business_partner_id', UUID(as_uuid=True),
                  sa.ForeignKey('business_partner.id', ondelete='CASCADE'), nullable=False),
        sa.Column('role', sa.String(50), nullable=False),
        sa.Column('customer_id', UUID(as_uuid=True),
                  sa.ForeignKey('customer.id', ondelete='SET NULL'), nullable=True),
        sa.Column('supplier_id', UUID(as_uuid=True),
                  sa.ForeignKey('supplier.id', ondelete='SET NULL'), nullable=True),
        sa.Column('attributes', JSONB(), server_default='{}'),
        sa.Column('is_active', sa.Boolean(), server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.UniqueConstraint('vendor_id', 'business_partner_id', 'role', name='uq_bp_role'),
    )
    op.create_index('ix_bpr_vendor_bp', 'business_partner_role', ['vendor_id', 'business_partner_id'])
    op.create_index('ix_bpr_customer', 'business_partner_role', ['customer_id'])
    op.create_index('ix_bpr_supplier', 'business_partner_role', ['supplier_id'])


def downgrade():
    op.drop_index('ix_bpr_supplier', table_name='business_partner_role')
    op.drop_index('ix_bpr_customer', table_name='business_partner_role')
    op.drop_index('ix_bpr_vendor_bp', table_name='business_partner_role')
    op.drop_table('business_partner_role')

    op.drop_index('ix_bp_vendor_email', table_name='business_partner')
    op.drop_index('ix_bp_vendor_phone', table_name='business_partner')
    op.drop_index('ix_bp_vendor_gstin', table_name='business_partner')
    op.drop_index('ix_bp_vendor_name', table_name='business_partner')
    op.drop_index('ix_bp_vendor', table_name='business_partner')
    op.drop_table('business_partner')
