"""Add full product fields: brand, discounts, lifecycle, shipping, digital, subscription, audit

Revision ID: a1b2c3d4e5f6
Revises: f3a9c1d2e4b5
Create Date: 2026-03-11 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'f3a9c1d2e4b5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()

    stmts = [
        # Basic Info
        "ALTER TABLE product ADD COLUMN IF NOT EXISTS brand VARCHAR(255)",
        "ALTER TABLE product ADD COLUMN IF NOT EXISTS product_type VARCHAR(30) DEFAULT 'physical'",

        # Pricing & Discounts
        "ALTER TABLE product ADD COLUMN IF NOT EXISTS discount_percentage NUMERIC(5,2)",
        "ALTER TABLE product ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12,2)",
        "ALTER TABLE product ADD COLUMN IF NOT EXISTS discount_start_date TIMESTAMPTZ",
        "ALTER TABLE product ADD COLUMN IF NOT EXISTS discount_end_date TIMESTAMPTZ",
        "ALTER TABLE product ADD COLUMN IF NOT EXISTS offer_label VARCHAR(100)",
        "ALTER TABLE product ADD COLUMN IF NOT EXISTS is_on_sale BOOLEAN DEFAULT FALSE",

        # Tax
        "ALTER TABLE product ADD COLUMN IF NOT EXISTS gst_rate NUMERIC(5,2)",

        # Inventory
        "ALTER TABLE product ADD COLUMN IF NOT EXISTS reorder_point INTEGER",
        "ALTER TABLE product ADD COLUMN IF NOT EXISTS reorder_quantity INTEGER",
        "ALTER TABLE product ADD COLUMN IF NOT EXISTS stock_status VARCHAR(30) DEFAULT 'in_stock'",
        "ALTER TABLE product ADD COLUMN IF NOT EXISTS allow_backorders BOOLEAN DEFAULT FALSE",

        # Product Lifecycle
        "ALTER TABLE product ADD COLUMN IF NOT EXISTS expiration_date DATE",
        "ALTER TABLE product ADD COLUMN IF NOT EXISTS manufacture_date DATE",
        "ALTER TABLE product ADD COLUMN IF NOT EXISTS best_before_date DATE",
        "ALTER TABLE product ADD COLUMN IF NOT EXISTS warranty_period_days INTEGER",
        "ALTER TABLE product ADD COLUMN IF NOT EXISTS warranty_type VARCHAR(30)",

        # Return & Warranty
        "ALTER TABLE product ADD COLUMN IF NOT EXISTS return_policy TEXT",
        "ALTER TABLE product ADD COLUMN IF NOT EXISTS return_days INTEGER",
        "ALTER TABLE product ADD COLUMN IF NOT EXISTS is_returnable BOOLEAN DEFAULT TRUE",
        "ALTER TABLE product ADD COLUMN IF NOT EXISTS return_conditions TEXT",
        "ALTER TABLE product ADD COLUMN IF NOT EXISTS refund_policy VARCHAR(50)",

        # Shipping & Delivery
        "ALTER TABLE product ADD COLUMN IF NOT EXISTS weight_kg NUMERIC(8,3)",
        "ALTER TABLE product ADD COLUMN IF NOT EXISTS length_cm NUMERIC(8,2)",
        "ALTER TABLE product ADD COLUMN IF NOT EXISTS width_cm NUMERIC(8,2)",
        "ALTER TABLE product ADD COLUMN IF NOT EXISTS height_cm NUMERIC(8,2)",
        "ALTER TABLE product ADD COLUMN IF NOT EXISTS shipping_class VARCHAR(30)",
        "ALTER TABLE product ADD COLUMN IF NOT EXISTS requires_shipping BOOLEAN DEFAULT TRUE",
        "ALTER TABLE product ADD COLUMN IF NOT EXISTS shipping_cost NUMERIC(12,2)",
        "ALTER TABLE product ADD COLUMN IF NOT EXISTS free_shipping_threshold NUMERIC(12,2)",

        # Visibility & Marketing
        "ALTER TABLE product ADD COLUMN IF NOT EXISTS is_new_arrival BOOLEAN DEFAULT FALSE",
        "ALTER TABLE product ADD COLUMN IF NOT EXISTS is_best_seller BOOLEAN DEFAULT FALSE",

        # SEO
        "ALTER TABLE product ADD COLUMN IF NOT EXISTS meta_keywords JSONB DEFAULT '[]'::jsonb",
        "ALTER TABLE product ADD COLUMN IF NOT EXISTS og_image_url VARCHAR(500)",
        "ALTER TABLE product ADD COLUMN IF NOT EXISTS canonical_url VARCHAR(500)",

        # Advanced
        "ALTER TABLE product ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}'::jsonb",
        "ALTER TABLE product ADD COLUMN IF NOT EXISTS related_product_ids JSONB DEFAULT '[]'::jsonb",
        "ALTER TABLE product ADD COLUMN IF NOT EXISTS upsell_product_ids JSONB DEFAULT '[]'::jsonb",
        "ALTER TABLE product ADD COLUMN IF NOT EXISTS cross_sell_product_ids JSONB DEFAULT '[]'::jsonb",

        # Digital Products
        "ALTER TABLE product ADD COLUMN IF NOT EXISTS is_digital BOOLEAN DEFAULT FALSE",
        "ALTER TABLE product ADD COLUMN IF NOT EXISTS download_url TEXT",
        "ALTER TABLE product ADD COLUMN IF NOT EXISTS download_limit INTEGER",
        "ALTER TABLE product ADD COLUMN IF NOT EXISTS download_expiry_days INTEGER",

        # Subscription
        "ALTER TABLE product ADD COLUMN IF NOT EXISTS is_subscription BOOLEAN DEFAULT FALSE",
        "ALTER TABLE product ADD COLUMN IF NOT EXISTS subscription_interval VARCHAR(20)",
        "ALTER TABLE product ADD COLUMN IF NOT EXISTS subscription_price NUMERIC(12,2)",

        # Audit & Tracking
        "ALTER TABLE product ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES \"user\"(id) ON DELETE SET NULL",
        "ALTER TABLE product ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES \"user\"(id) ON DELETE SET NULL",
        "ALTER TABLE product ADD COLUMN IF NOT EXISTS version_number INTEGER DEFAULT 1",
        "ALTER TABLE product ADD COLUMN IF NOT EXISTS change_history JSONB DEFAULT '[]'::jsonb",
        "ALTER TABLE product ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0",
        "ALTER TABLE product ADD COLUMN IF NOT EXISTS purchase_count INTEGER DEFAULT 0",
    ]

    for stmt in stmts:
        conn.execute(sa.text(stmt))

    # Indexes
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS idx_product_brand ON product (brand)"))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS idx_product_type ON product (product_type)"))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS idx_product_stock_status ON product (stock_status)"))


def downgrade() -> None:
    cols = [
        "brand", "product_type",
        "discount_percentage", "discount_amount", "discount_start_date", "discount_end_date",
        "offer_label", "is_on_sale", "gst_rate",
        "reorder_point", "reorder_quantity", "stock_status", "allow_backorders",
        "expiration_date", "manufacture_date", "best_before_date",
        "warranty_period_days", "warranty_type",
        "return_policy", "return_days", "is_returnable", "return_conditions", "refund_policy",
        "weight_kg", "length_cm", "width_cm", "height_cm",
        "shipping_class", "requires_shipping", "shipping_cost", "free_shipping_threshold",
        "is_new_arrival", "is_best_seller",
        "meta_keywords", "og_image_url", "canonical_url",
        "custom_fields", "related_product_ids", "upsell_product_ids", "cross_sell_product_ids",
        "is_digital", "download_url", "download_limit", "download_expiry_days",
        "is_subscription", "subscription_interval", "subscription_price",
        "created_by", "updated_by", "version_number", "change_history",
        "view_count", "purchase_count",
    ]
    conn = op.get_bind()
    for col in cols:
        conn.execute(sa.text(f"ALTER TABLE product DROP COLUMN IF EXISTS {col}"))
    conn.execute(sa.text("DROP INDEX IF EXISTS idx_product_brand"))
    conn.execute(sa.text("DROP INDEX IF EXISTS idx_product_type"))
    conn.execute(sa.text("DROP INDEX IF EXISTS idx_product_stock_status"))
