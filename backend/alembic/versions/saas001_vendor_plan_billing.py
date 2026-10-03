"""Add max_apps + vendor SaaS billing columns; seed Starter/Growth/Professional.

Revision ID: saas001_vendor_plan_billing
Revises: hr002_leave_groups_holiday_calendars
"""
from alembic import op

revision = "saas001_vendor_plan_billing"
down_revision = "hr002_leave_groups_holiday_calendars"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE vendor_plan ADD COLUMN IF NOT EXISTS max_apps INTEGER DEFAULT -1")
    op.execute("ALTER TABLE vendor ADD COLUMN IF NOT EXISTS billing_status VARCHAR(20) DEFAULT 'none'")
    op.execute("ALTER TABLE vendor ADD COLUMN IF NOT EXISTS billing_razorpay_order_id VARCHAR(100)")
    op.execute("ALTER TABLE vendor ADD COLUMN IF NOT EXISTS billing_last_payment_id VARCHAR(100)")
    op.execute(
        """
        INSERT INTO vendor_plan (
            id, name, slug, description,
            price_monthly, price_yearly, currency,
            max_products, max_services, max_team_members, max_storage_mb, max_apps,
            features, is_active, is_featured, sort_order
        ) VALUES
        (
            gen_random_uuid(), 'Starter', 'starter',
            'My Kit plus any 1 app. Upgrade anytime for more modules.',
            199, 1990, 'INR',
            100, 20, 3, 2000, 1,
            '{"custom_domain": false, "analytics": true, "api_access": false, "priority_support": false, "white_label": false, "branded_app": false, "restaurant": true, "pos": true}'::jsonb,
            TRUE, FALSE, 10
        ),
        (
            gen_random_uuid(), 'Growth', 'growth',
            'My Kit plus up to 6 apps. Best for growing teams.',
            599, 5990, 'INR',
            1000, 100, 10, 10000, 6,
            '{"custom_domain": true, "analytics": true, "api_access": false, "priority_support": true, "white_label": false, "branded_app": false, "restaurant": true, "pos": true}'::jsonb,
            TRUE, TRUE, 20
        ),
        (
            gen_random_uuid(), 'Professional', 'professional',
            'My Kit plus all apps — full KIT ERP platform.',
            999, 9990, 'INR',
            -1, -1, 50, 50000, -1,
            '{"custom_domain": true, "analytics": true, "api_access": true, "priority_support": true, "white_label": false, "branded_app": true, "restaurant": true, "pos": true}'::jsonb,
            TRUE, FALSE, 30
        )
        ON CONFLICT (slug) DO UPDATE SET
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            price_monthly = EXCLUDED.price_monthly,
            price_yearly = EXCLUDED.price_yearly,
            max_apps = EXCLUDED.max_apps,
            is_active = TRUE,
            is_featured = EXCLUDED.is_featured,
            sort_order = EXCLUDED.sort_order,
            updated_at = now()
        """
    )
    op.execute(
        """
        UPDATE vendor_plan
        SET is_active = FALSE, updated_at = now()
        WHERE slug NOT IN ('starter', 'growth', 'professional')
          AND is_active = TRUE
        """
    )


def downgrade() -> None:
    op.execute("ALTER TABLE vendor DROP COLUMN IF EXISTS billing_last_payment_id")
    op.execute("ALTER TABLE vendor DROP COLUMN IF EXISTS billing_razorpay_order_id")
    op.execute("ALTER TABLE vendor DROP COLUMN IF EXISTS billing_status")
    op.execute("ALTER TABLE vendor_plan DROP COLUMN IF EXISTS max_apps")
