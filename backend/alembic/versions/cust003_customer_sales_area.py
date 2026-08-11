"""add sales_area_id to customer (default sales area for dues / new documents)

Revision ID: cust003_customer_sales_area
Revises: cfg003_customer_pricing_group
Create Date: 2026-08-12
"""
from alembic import op
import sqlalchemy as sa

revision = "cust003_customer_sales_area"
down_revision = "cfg003_customer_pricing_group"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(sa.text("ALTER TABLE customer ADD COLUMN IF NOT EXISTS sales_area_id UUID"))
    op.execute(sa.text("""
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sales_area')
               AND NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'fk_customer_sales_area_id'
               ) THEN
                ALTER TABLE customer
                ADD CONSTRAINT fk_customer_sales_area_id
                FOREIGN KEY (sales_area_id) REFERENCES sales_area(id) ON DELETE SET NULL;
            END IF;
        END $$;
    """))
    op.execute(sa.text(
        "CREATE INDEX IF NOT EXISTS ix_customer_sales_area_id ON customer (sales_area_id)"
    ))
    op.execute(sa.text(
        "CREATE INDEX IF NOT EXISTS ix_customer_vendor_sales_area ON customer (vendor_id, sales_area_id)"
    ))


def downgrade() -> None:
    op.execute(sa.text("DROP INDEX IF EXISTS ix_customer_vendor_sales_area"))
    op.execute(sa.text("DROP INDEX IF EXISTS ix_customer_sales_area_id"))
    op.execute(sa.text(
        "ALTER TABLE customer DROP CONSTRAINT IF EXISTS fk_customer_sales_area_id"
    ))
    op.execute(sa.text("ALTER TABLE customer DROP COLUMN IF EXISTS sales_area_id"))
