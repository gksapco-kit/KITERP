"""cust004 – add payment_terms_days to customer

Revision ID: cust004_customer_payment_terms
Revises: cust003_customer_sales_area
Create Date: 2026-10-15
"""
from alembic import op
import sqlalchemy as sa

revision = 'cust004_customer_payment_terms'
down_revision = 'cust003_customer_sales_area'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'customer',
        sa.Column('payment_terms_days', sa.Integer(), nullable=True),
    )


def downgrade():
    op.drop_column('customer', 'payment_terms_days')
