"""sales & distribution: division, distribution channel, delivery channel, sales area

Revision ID: ms007_sales_area
Revises: ms006_store_hierarchy
Create Date: 2026-07-01

Adds SAP-SD-style organizational data on top of the existing Business Unit
(Store with parent_id IS NULL = Sales Organization):

  sales_division        — product-line grouping
  distribution_channel  — how products are sold (retail/wholesale/online/...)
  delivery_channel      — how orders are fulfilled (own fleet/courier/pickup/...)
  sales_area            — Business Unit x Distribution Channel x Division

Plus nullable link columns: order/pos_transaction/booking.sales_area_id +
delivery_channel_id, invoice.sales_area_id, product.division_id. All additive
and nullable — no existing behaviour changes.

Idempotent: safe to re-run; mirrors app.database.ensure_sales_area_tables.
"""
from alembic import op
import sqlalchemy as sa

revision = 'ms007_sales_area'
down_revision = 'ms006_store_hierarchy'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return

    op.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS sales_division (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
            code VARCHAR(20) NOT NULL,
            name VARCHAR(200) NOT NULL,
            description TEXT,
            is_active BOOLEAN DEFAULT TRUE,
            is_default BOOLEAN DEFAULT FALSE,
            sort_order INTEGER DEFAULT 0,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now(),
            CONSTRAINT uq_sales_division_vendor_code UNIQUE (vendor_id, code)
        );
    """))
    op.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_sales_division_vendor ON sales_division (vendor_id, is_active);"))

    op.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS distribution_channel (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
            code VARCHAR(20) NOT NULL,
            name VARCHAR(200) NOT NULL,
            channel_type VARCHAR(20) NOT NULL DEFAULT 'retail',
            description TEXT,
            is_active BOOLEAN DEFAULT TRUE,
            is_default BOOLEAN DEFAULT FALSE,
            sort_order INTEGER DEFAULT 0,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now(),
            CONSTRAINT uq_distribution_channel_vendor_code UNIQUE (vendor_id, code)
        );
    """))
    op.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_distribution_channel_vendor ON distribution_channel (vendor_id, is_active);"))

    op.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS delivery_channel (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
            code VARCHAR(20) NOT NULL,
            name VARCHAR(200) NOT NULL,
            mode VARCHAR(20) NOT NULL DEFAULT 'own_fleet',
            description TEXT,
            lead_time_days INTEGER,
            base_charge NUMERIC(12,2) DEFAULT 0,
            settings JSONB DEFAULT '{}'::jsonb,
            is_active BOOLEAN DEFAULT TRUE,
            is_default BOOLEAN DEFAULT FALSE,
            sort_order INTEGER DEFAULT 0,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now(),
            CONSTRAINT uq_delivery_channel_vendor_code UNIQUE (vendor_id, code)
        );
    """))
    op.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_delivery_channel_vendor ON delivery_channel (vendor_id, is_active);"))

    op.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS sales_area (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
            business_unit_id UUID NOT NULL REFERENCES store(id) ON DELETE CASCADE,
            distribution_channel_id UUID NOT NULL REFERENCES distribution_channel(id) ON DELETE CASCADE,
            division_id UUID NOT NULL REFERENCES sales_division(id) ON DELETE CASCADE,
            code VARCHAR(80),
            name VARCHAR(255),
            is_active BOOLEAN DEFAULT TRUE,
            is_default BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now(),
            CONSTRAINT uq_sales_area_combo UNIQUE (vendor_id, business_unit_id, distribution_channel_id, division_id)
        );
    """))
    op.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_sales_area_vendor ON sales_area (vendor_id, is_active);"))
    op.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_sales_area_bu ON sales_area (business_unit_id);"))

    op.execute(sa.text('ALTER TABLE "order" ADD COLUMN IF NOT EXISTS sales_area_id UUID'))
    op.execute(sa.text('ALTER TABLE "order" ADD COLUMN IF NOT EXISTS delivery_channel_id UUID'))
    op.execute(sa.text("ALTER TABLE pos_transaction ADD COLUMN IF NOT EXISTS sales_area_id UUID"))
    op.execute(sa.text("ALTER TABLE pos_transaction ADD COLUMN IF NOT EXISTS delivery_channel_id UUID"))
    op.execute(sa.text("ALTER TABLE booking ADD COLUMN IF NOT EXISTS sales_area_id UUID"))
    op.execute(sa.text("ALTER TABLE booking ADD COLUMN IF NOT EXISTS delivery_channel_id UUID"))
    op.execute(sa.text("ALTER TABLE invoice ADD COLUMN IF NOT EXISTS sales_area_id UUID"))
    op.execute(sa.text("ALTER TABLE product ADD COLUMN IF NOT EXISTS division_id UUID"))

    fk_specs = (
        ("fk_order_sales_area", '"order"', "sales_area_id", "sales_area"),
        ("fk_order_delivery_channel", '"order"', "delivery_channel_id", "delivery_channel"),
        ("fk_pos_txn_sales_area", "pos_transaction", "sales_area_id", "sales_area"),
        ("fk_pos_txn_delivery_channel", "pos_transaction", "delivery_channel_id", "delivery_channel"),
        ("fk_booking_sales_area", "booking", "sales_area_id", "sales_area"),
        ("fk_booking_delivery_channel", "booking", "delivery_channel_id", "delivery_channel"),
        ("fk_invoice_sales_area", "invoice", "sales_area_id", "sales_area"),
        ("fk_product_division", "product", "division_id", "sales_division"),
    )
    for fk_name, table, column, ref_table in fk_specs:
        op.execute(sa.text(f"""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = '{fk_name}'
                ) THEN
                    ALTER TABLE {table}
                    ADD CONSTRAINT {fk_name}
                    FOREIGN KEY ({column}) REFERENCES {ref_table}(id) ON DELETE SET NULL;
                END IF;
            END $$;
        """))

    op.execute(sa.text('CREATE INDEX IF NOT EXISTS ix_order_sales_area ON "order" (vendor_id, sales_area_id)'))
    op.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_pos_txn_sales_area ON pos_transaction (vendor_id, sales_area_id)"))
    op.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_booking_sales_area ON booking (vendor_id, sales_area_id)"))
    op.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_invoice_sales_area ON invoice (vendor_id, sales_area_id)"))
    op.execute(sa.text("CREATE INDEX IF NOT EXISTS idx_product_division ON product (vendor_id, division_id)"))


def downgrade():
    op.execute(sa.text('ALTER TABLE "order" DROP COLUMN IF EXISTS sales_area_id'))
    op.execute(sa.text('ALTER TABLE "order" DROP COLUMN IF EXISTS delivery_channel_id'))
    op.execute(sa.text("ALTER TABLE pos_transaction DROP COLUMN IF EXISTS sales_area_id"))
    op.execute(sa.text("ALTER TABLE pos_transaction DROP COLUMN IF EXISTS delivery_channel_id"))
    op.execute(sa.text("ALTER TABLE booking DROP COLUMN IF EXISTS sales_area_id"))
    op.execute(sa.text("ALTER TABLE booking DROP COLUMN IF EXISTS delivery_channel_id"))
    op.execute(sa.text("ALTER TABLE invoice DROP COLUMN IF EXISTS sales_area_id"))
    op.execute(sa.text("ALTER TABLE product DROP COLUMN IF EXISTS division_id"))
    op.drop_table('sales_area')
    op.drop_table('delivery_channel')
    op.drop_table('distribution_channel')
    op.drop_table('sales_division')
