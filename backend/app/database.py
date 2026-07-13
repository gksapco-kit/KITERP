# app/database.py
import logging
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from typing import AsyncGenerator
from app.config import settings

logger = logging.getLogger(__name__)

# PostgreSQL
engine = create_async_engine(
    settings.DATABASE_URL,
    pool_size=settings.DATABASE_POOL_SIZE,
    echo=settings.DEBUG,
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

Base = declarative_base()


async def ensure_vendor_order_acceptance_columns() -> None:
    """
    Ensure vendor.order_acceptance_* columns exist (ORM expects them).

    Idempotent: safe if Alembic already applied. Covers cases where DATABASE_URL
    points at a different DB than the one migrations were run against.
    """
    if "postgresql" not in settings.DATABASE_URL.lower():
        return
    async with engine.begin() as conn:
        await conn.execute(
            text(
                """
                ALTER TABLE vendor
                ADD COLUMN IF NOT EXISTS order_acceptance_enabled BOOLEAN DEFAULT TRUE;
                """
            )
        )
        await conn.execute(
            text(
                """
                ALTER TABLE vendor
                ADD COLUMN IF NOT EXISTS order_acceptance_hours JSONB DEFAULT '{}'::jsonb;
                """
            )
        )
        await conn.execute(
            text(
                """
                UPDATE vendor SET order_acceptance_enabled = TRUE
                WHERE order_acceptance_enabled IS NULL;
                """
            )
        )
        await conn.execute(
            text(
                """
                ALTER TABLE vendor
                ALTER COLUMN order_acceptance_enabled SET NOT NULL;
                """
            )
        )


async def ensure_vendor_external_domain_columns() -> None:
    """
    Ensure vendor.external_domain_* columns exist (ORM + dom001 migration).

    Idempotent: safe when Alembic dom001_ext_domain was skipped (parallel branch from vf001).
    """
    if "postgresql" not in settings.DATABASE_URL.lower():
        return
    stmts = [
        "ALTER TABLE vendor ADD COLUMN IF NOT EXISTS external_domain_enabled BOOLEAN DEFAULT FALSE",
        "ALTER TABLE vendor ADD COLUMN IF NOT EXISTS external_domain_scope VARCHAR(20) DEFAULT 'all'",
        "ALTER TABLE vendor ADD COLUMN IF NOT EXISTS external_domain_name VARCHAR(255)",
        "ALTER TABLE vendor ADD COLUMN IF NOT EXISTS external_domain_registrar VARCHAR(60)",
        "ALTER TABLE vendor ADD COLUMN IF NOT EXISTS external_domain_reg_email VARCHAR(255)",
        "ALTER TABLE vendor ADD COLUMN IF NOT EXISTS external_domain_holder VARCHAR(255)",
        "ALTER TABLE vendor ADD COLUMN IF NOT EXISTS external_domain_expiry DATE",
        "ALTER TABLE vendor ADD COLUMN IF NOT EXISTS external_domain_access_status VARCHAR(30) DEFAULT 'not_requested'",
        "ALTER TABLE vendor ADD COLUMN IF NOT EXISTS external_domain_recovery_contact VARCHAR(255)",
        "ALTER TABLE vendor ADD COLUMN IF NOT EXISTS external_domain_notes TEXT",
        "ALTER TABLE vendor ADD COLUMN IF NOT EXISTS external_domain_access_requested_at TIMESTAMPTZ",
        "ALTER TABLE vendor ADD COLUMN IF NOT EXISTS external_domain_access_granted_at TIMESTAMPTZ",
        "UPDATE vendor SET external_domain_enabled = FALSE WHERE external_domain_enabled IS NULL",
        "UPDATE vendor SET external_domain_scope = 'all' WHERE external_domain_scope IS NULL",
        "UPDATE vendor SET external_domain_access_status = 'not_requested' WHERE external_domain_access_status IS NULL",
    ]
    async with engine.begin() as conn:
        for stmt in stmts:
            await conn.execute(text(stmt))


async def ensure_user_contact_not_globally_unique() -> None:
    """
    Drop global UNIQUE on user.email / user.phone so the same email or phone can
    exist on separate User rows (e.g. one team member per vendor).

    Idempotent. Use when Alembic revision 639f0d132b44 is not on the migration path
    in use, so the DB still has legacy unique indexes/constraints.
    """
    if "postgresql" not in settings.DATABASE_URL.lower():
        return
    async with engine.begin() as conn:
        await conn.execute(text("DROP INDEX IF EXISTS ix_user_email"))
        await conn.execute(text('ALTER TABLE "user" DROP CONSTRAINT IF EXISTS user_phone_key'))
        await conn.execute(text('ALTER TABLE "user" DROP CONSTRAINT IF EXISTS uq_user_phone'))
        await conn.execute(text("DROP INDEX IF EXISTS user_phone_key"))
        await conn.execute(text("DROP INDEX IF EXISTS uq_user_phone"))
        await conn.execute(text('CREATE INDEX IF NOT EXISTS ix_user_email ON "user" (email)'))
        await conn.execute(text('CREATE INDEX IF NOT EXISTS ix_user_phone ON "user" (phone)'))
    logger.info("ensure_user_contact_not_globally_unique: user.email / user.phone indexes refreshed (non-unique)")


async def ensure_customer_verification_columns() -> None:
    """Add customer password-reset OTP columns expected by the model."""
    if "postgresql" not in settings.DATABASE_URL.lower():
        return
    stmts = [
        "ALTER TABLE customer ADD COLUMN IF NOT EXISTS verification_code VARCHAR(64)",
        "ALTER TABLE customer ADD COLUMN IF NOT EXISTS verification_code_expires_at TIMESTAMPTZ",
    ]
    async with engine.begin() as conn:
        for s in stmts:
            await conn.execute(text(s))


async def ensure_user_platform_staff_role_column() -> None:
    """Add user columns/indexes the SQLAlchemy model expects but older DBs may lack (avoids 500 on auth).

    Covers migrations: platform staff role, OTP verification fields, email-change flow.
    """
    if "postgresql" not in settings.DATABASE_URL.lower():
        return
    stmts = [
        'ALTER TABLE "user" ADD COLUMN IF NOT EXISTS platform_staff_role VARCHAR(20)',
        'CREATE INDEX IF NOT EXISTS ix_user_platform_staff_role ON "user" (platform_staff_role)',
        'ALTER TABLE "user" ADD COLUMN IF NOT EXISTS verification_code VARCHAR(6)',
        'ALTER TABLE "user" ADD COLUMN IF NOT EXISTS verification_code_expires_at TIMESTAMPTZ',
        'ALTER TABLE "user" ADD COLUMN IF NOT EXISTS pending_email VARCHAR(255)',
        'ALTER TABLE "user" ADD COLUMN IF NOT EXISTS email_change_code VARCHAR(6)',
        'ALTER TABLE "user" ADD COLUMN IF NOT EXISTS email_change_expires_at TIMESTAMPTZ',
        'ALTER TABLE "user" ADD COLUMN IF NOT EXISTS account_delete_code VARCHAR(64)',
        'ALTER TABLE "user" ADD COLUMN IF NOT EXISTS account_delete_expires_at TIMESTAMPTZ',
        'ALTER TABLE "user" ADD COLUMN IF NOT EXISTS platform_staff_job_role VARCHAR(32)',
        'ALTER TABLE "user" ADD COLUMN IF NOT EXISTS platform_staff_manager_id UUID',
        'CREATE INDEX IF NOT EXISTS ix_user_platform_staff_job_role ON "user" (platform_staff_job_role)',
        'CREATE INDEX IF NOT EXISTS ix_user_platform_staff_manager_id ON "user" (platform_staff_manager_id)',
    ]
    async with engine.begin() as conn:
        for s in stmts:
            await conn.execute(text(s))
        # Self-FK (skip if already present)
        await conn.execute(
            text(
                """
                DO $$
                BEGIN
                  IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'fk_user_platform_staff_manager_id_user'
                  ) THEN
                    ALTER TABLE "user"
                    ADD CONSTRAINT fk_user_platform_staff_manager_id_user
                    FOREIGN KEY (platform_staff_manager_id) REFERENCES "user"(id) ON DELETE SET NULL;
                  END IF;
                END $$;
                """
            )
        )
        await conn.execute(
            text(
                """
                UPDATE "user"
                SET platform_staff_job_role = 'consulting'
                WHERE platform_staff_role = 'support'
                  AND platform_staff_job_role IS NULL
                """
            )
        )


async def ensure_product_uom_column() -> None:
    """Ensure product.uom column exists (ORM expects it)."""
    if "postgresql" not in settings.DATABASE_URL.lower():
        return
    async with engine.begin() as conn:
        await conn.execute(
            text(
                "ALTER TABLE product ADD COLUMN IF NOT EXISTS uom VARCHAR(30) DEFAULT 'piece';"
            )
        )
        await conn.execute(
            text(
                "ALTER TABLE product ADD COLUMN IF NOT EXISTS uom_quantity NUMERIC(12,4);"
            )
        )


async def ensure_variant_pricing_columns() -> None:
    """Ensure product_variant has uom, currency, discount columns."""
    if "postgresql" not in settings.DATABASE_URL.lower():
        return
    stmts = [
        "ALTER TABLE product_variant ADD COLUMN IF NOT EXISTS uom VARCHAR(30) DEFAULT 'piece';",
        "ALTER TABLE product_variant ADD COLUMN IF NOT EXISTS uom_quantity NUMERIC(12,4);",
        "ALTER TABLE product_variant ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'INR';",
        "ALTER TABLE product_variant ADD COLUMN IF NOT EXISTS discount_percentage NUMERIC(5,2);",
        "ALTER TABLE product_variant ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12,2);",
        "ALTER TABLE product_variant ADD COLUMN IF NOT EXISTS offer_label VARCHAR(100);",
        "ALTER TABLE product_variant ADD COLUMN IF NOT EXISTS is_on_sale BOOLEAN DEFAULT false;",
        "ALTER TABLE product_variant ADD COLUMN IF NOT EXISTS weight_kg NUMERIC(8,3);",
        "ALTER TABLE product_variant ADD COLUMN IF NOT EXISTS is_taxable BOOLEAN DEFAULT true;",
        "ALTER TABLE product_variant ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5,2);",
        "ALTER TABLE product_variant ADD COLUMN IF NOT EXISTS hsn_code VARCHAR(8);",
        "ALTER TABLE product_variant ADD COLUMN IF NOT EXISTS gst_rate NUMERIC(5,2);",
        "ALTER TABLE product_variant ADD COLUMN IF NOT EXISTS low_stock_threshold INTEGER DEFAULT 5;",
        "ALTER TABLE product_variant ADD COLUMN IF NOT EXISTS stock_status VARCHAR(30) DEFAULT 'in_stock';",
        "ALTER TABLE product_variant ADD COLUMN IF NOT EXISTS reorder_point INTEGER;",
        "ALTER TABLE product_variant ADD COLUMN IF NOT EXISTS reorder_quantity INTEGER;",
        "ALTER TABLE product_variant ADD COLUMN IF NOT EXISTS allow_backorders BOOLEAN DEFAULT false;",
        "ALTER TABLE product_variant ADD COLUMN IF NOT EXISTS track_inventory BOOLEAN DEFAULT true;",
        "ALTER TABLE product_variant ADD COLUMN IF NOT EXISTS expiration_date DATE;",
        "ALTER TABLE product_variant ADD COLUMN IF NOT EXISTS manufacture_date DATE;",
        "ALTER TABLE product_variant ADD COLUMN IF NOT EXISTS best_before_date DATE;",
        "ALTER TABLE product_variant ADD COLUMN IF NOT EXISTS warranty_period_days INTEGER;",
        "ALTER TABLE product_variant ADD COLUMN IF NOT EXISTS warranty_type VARCHAR(30);",
        "ALTER TABLE product_variant ADD COLUMN IF NOT EXISTS is_returnable BOOLEAN DEFAULT true;",
        "ALTER TABLE product_variant ADD COLUMN IF NOT EXISTS return_days INTEGER;",
        "ALTER TABLE product_variant ADD COLUMN IF NOT EXISTS refund_policy VARCHAR(30);",
        "ALTER TABLE product_variant ADD COLUMN IF NOT EXISTS return_policy TEXT;",
        "ALTER TABLE product_variant ADD COLUMN IF NOT EXISTS return_conditions TEXT;",
        "ALTER TABLE product_variant ADD COLUMN IF NOT EXISTS color VARCHAR(50);",
        # Variant generator / config-engine columns (cfg002) — required by ORM on every insert
        "ALTER TABLE product_variant ADD COLUMN IF NOT EXISTS config_selection JSONB;",
        "ALTER TABLE product_variant ADD COLUMN IF NOT EXISTS variant_hash VARCHAR(64);",
        "ALTER TABLE product_variant ADD COLUMN IF NOT EXISTS search_keywords TEXT;",
    ]
    async with engine.begin() as conn:
        for s in stmts:
            await conn.execute(text(s))
        await conn.execute(text(
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_variant_hash_unique "
            "ON product_variant (product_id, variant_hash) "
            "WHERE variant_hash IS NOT NULL;"
        ))
        await conn.execute(text(
            "ALTER TABLE product ADD COLUMN IF NOT EXISTS shipping_cost_type VARCHAR(30) DEFAULT 'fixed';"
        ))


async def ensure_goods_movement_codes() -> None:
    """Widen movement_type columns and migrate legacy SAP numeric codes to descriptive codes (idempotent)."""
    if "postgresql" not in settings.DATABASE_URL.lower():
        return
    # old SAP numeric code -> new descriptive code
    code_map = {
        "101": "gr_po",
        "102": "gr_reversal",
        "122": "return_to_vendor",
        "201": "gi_cost_center",
        "261": "gi_production",
        "301": "plant_transfer",
        "311": "sloc_transfer",
        "501": "receipt_no_po",
    }
    # Manufacturing (CO) movements use order-specific descriptive codes
    co_code_map = {
        "261": "component_issue",
        "262": "component_return",
        "101": "fg_receipt",
        "102": "fg_receipt_reversal",
    }
    async with engine.begin() as conn:
        # Widen to accommodate descriptive codes
        await conn.execute(text(
            "ALTER TABLE goods_movement_document ALTER COLUMN movement_type TYPE VARCHAR(30)"
        ))
        await conn.execute(text(
            "ALTER TABLE purchase_order_receipt ALTER COLUMN movement_type TYPE VARCHAR(30)"
        ))
        await conn.execute(text(
            "ALTER TABLE purchase_order_receipt ALTER COLUMN movement_type SET DEFAULT 'gr_po'"
        ))
        # Backfill legacy numeric codes
        for old, new in code_map.items():
            await conn.execute(
                text("UPDATE goods_movement_document SET movement_type = :new WHERE movement_type = :old"),
                {"new": new, "old": old},
            )
            await conn.execute(
                text("UPDATE purchase_order_receipt SET movement_type = :new WHERE movement_type = :old"),
                {"new": new, "old": old},
            )
    # Manufacturing (CO) goods movements — widen + backfill in a separate
    # transaction so a missing table on older DBs can't poison the rest.
    try:
        async with engine.begin() as conn:
            await conn.execute(text(
                "ALTER TABLE co_goods_movement ALTER COLUMN movement_type TYPE VARCHAR(30)"
            ))
            for old, new in co_code_map.items():
                await conn.execute(
                    text("UPDATE co_goods_movement SET movement_type = :new WHERE movement_type = :old"),
                    {"new": new, "old": old},
                )
    except Exception:
        pass


async def ensure_merchandising_tables() -> None:
    """Create bundle, bundle_item, upsell_mapping if they don't exist."""
    if "postgresql" not in settings.DATABASE_URL.lower():
        return
    stmts = [
        """CREATE TABLE IF NOT EXISTS bundle (
            id UUID PRIMARY KEY,
            vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
            name VARCHAR(255) NOT NULL,
            slug VARCHAR(255) NOT NULL,
            description TEXT,
            discount_type VARCHAR(20) DEFAULT 'none',
            discount_value NUMERIC(12,2) DEFAULT 0,
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now()
        );""",
        "CREATE INDEX IF NOT EXISTS idx_bundle_vendor ON bundle(vendor_id);",
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_bundle_slug ON bundle(vendor_id, slug);",
        """CREATE TABLE IF NOT EXISTS bundle_item (
            id UUID PRIMARY KEY,
            bundle_id UUID NOT NULL REFERENCES bundle(id) ON DELETE CASCADE,
            product_id UUID NOT NULL REFERENCES product(id) ON DELETE CASCADE,
            quantity INTEGER NOT NULL DEFAULT 1,
            sort_order INTEGER DEFAULT 0,
            UNIQUE(bundle_id, product_id)
        );""",
        """CREATE TABLE IF NOT EXISTS upsell_mapping (
            id UUID PRIMARY KEY,
            vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
            source_product_id UUID NOT NULL REFERENCES product(id) ON DELETE CASCADE,
            target_type VARCHAR(20) NOT NULL DEFAULT 'product',
            target_product_id UUID REFERENCES product(id) ON DELETE CASCADE,
            target_category VARCHAR(100),
            relation_type VARCHAR(20) NOT NULL,
            bundle_id UUID REFERENCES bundle(id) ON DELETE SET NULL,
            trigger_stage VARCHAR(20) NOT NULL DEFAULT 'PDP',
            priority INTEGER DEFAULT 0,
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now(),
            CHECK(relation_type IN ('cross_sell', 'upsell')),
            CHECK(trigger_stage IN ('PDP', 'CART', 'CHECKOUT')),
            CHECK(target_type IN ('product', 'category'))
        );""",
        "ALTER TABLE upsell_mapping ADD COLUMN IF NOT EXISTS target_type VARCHAR(20) NOT NULL DEFAULT 'product';",
        "ALTER TABLE upsell_mapping ADD COLUMN IF NOT EXISTS target_category VARCHAR(100);",
        "CREATE INDEX IF NOT EXISTS idx_upsell_lookup ON upsell_mapping(vendor_id, source_product_id, relation_type, trigger_stage);",
        "CREATE INDEX IF NOT EXISTS idx_upsell_priority ON upsell_mapping(source_product_id, relation_type, priority);",
        "CREATE INDEX IF NOT EXISTS idx_upsell_category ON upsell_mapping(vendor_id, target_category);",
    ]
    async with engine.begin() as conn:
        for s in stmts:
            await conn.execute(text(s))


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()



async def ensure_loyalty_tables() -> None:
    """Create loyalty tables and new POS columns if they don't exist."""
    if "postgresql" not in settings.DATABASE_URL.lower():
        return
    async with engine.begin() as conn:
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS loyalty_program (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                vendor_id UUID NOT NULL REFERENCES vendor(id),
                is_active BOOLEAN DEFAULT FALSE,
                name VARCHAR(255) DEFAULT 'Loyalty Rewards',
                points_per_currency NUMERIC(10,2) DEFAULT 1,
                currency_per_point NUMERIC(10,4) DEFAULT 1,
                min_redeem_points INTEGER DEFAULT 100,
                max_redeem_percent INTEGER DEFAULT 50,
                signup_bonus INTEGER DEFAULT 0,
                tier_config JSONB DEFAULT '[]'::jsonb,
                created_at TIMESTAMPTZ DEFAULT now(),
                updated_at TIMESTAMPTZ DEFAULT now(),
                CONSTRAINT uq_loyalty_program_vendor UNIQUE (vendor_id)
            );
        """))
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS loyalty_account (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                vendor_id UUID NOT NULL REFERENCES vendor(id),
                customer_id UUID NOT NULL REFERENCES customer(id),
                points_balance INTEGER DEFAULT 0,
                lifetime_earned INTEGER DEFAULT 0,
                lifetime_redeemed INTEGER DEFAULT 0,
                tier VARCHAR(50) DEFAULT 'standard',
                created_at TIMESTAMPTZ DEFAULT now(),
                updated_at TIMESTAMPTZ DEFAULT now()
            );
        """))
        await conn.execute(text("""
            CREATE UNIQUE INDEX IF NOT EXISTS uq_loyalty_vendor_customer
            ON loyalty_account (vendor_id, customer_id);
        """))
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS loyalty_transaction (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                vendor_id UUID NOT NULL REFERENCES vendor(id),
                customer_id UUID NOT NULL REFERENCES customer(id),
                account_id UUID NOT NULL REFERENCES loyalty_account(id),
                type VARCHAR(20) NOT NULL,
                points INTEGER NOT NULL,
                balance_after INTEGER NOT NULL,
                description TEXT,
                reference_type VARCHAR(30),
                reference_id UUID,
                created_at TIMESTAMPTZ DEFAULT now()
            );
        """))
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS ix_loyalty_txn_customer
            ON loyalty_transaction (customer_id, created_at);
        """))
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS ix_loyalty_txn_vendor
            ON loyalty_transaction (vendor_id, created_at);
        """))
        # POS transaction new columns
        for col_sql in [
            "ALTER TABLE pos_transaction ADD COLUMN IF NOT EXISTS coupon_code VARCHAR(50);",
            "ALTER TABLE pos_transaction ADD COLUMN IF NOT EXISTS coupon_discount NUMERIC(12,2) DEFAULT 0;",
            "ALTER TABLE pos_transaction ADD COLUMN IF NOT EXISTS loyalty_points_redeemed INTEGER DEFAULT 0;",
            "ALTER TABLE pos_transaction ADD COLUMN IF NOT EXISTS loyalty_points_earned INTEGER DEFAULT 0;",
            "ALTER TABLE pos_transaction ADD COLUMN IF NOT EXISTS loyalty_discount NUMERIC(12,2) DEFAULT 0;",
        ]:
            await conn.execute(text(col_sql))


async def ensure_crm_tables() -> None:
    """Create all CRM (crm_*) tables idempotently. Mirrors Alembic schema in
    backend/app/models/crm.py. Safe to call on every boot."""
    if "postgresql" not in settings.DATABASE_URL.lower():
        return
    stmts = [
        # Accounts
        """CREATE TABLE IF NOT EXISTS crm_account (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
            parent_id UUID REFERENCES crm_account(id) ON DELETE SET NULL,
            name VARCHAR(255) NOT NULL,
            industry VARCHAR(100),
            region VARCHAR(100),
            website VARCHAR(500),
            phone VARCHAR(50),
            email VARCHAR(255),
            annual_revenue NUMERIC(14,2),
            employee_count INTEGER,
            billing_address JSONB DEFAULT '{}'::jsonb,
            shipping_address JSONB DEFAULT '{}'::jsonb,
            tags JSONB DEFAULT '[]'::jsonb,
            custom_fields JSONB DEFAULT '{}'::jsonb,
            notes TEXT,
            owner_id UUID REFERENCES "user"(id) ON DELETE SET NULL,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now()
        );""",
        "CREATE INDEX IF NOT EXISTS ix_crm_account_vendor_id ON crm_account(vendor_id);",
        "CREATE INDEX IF NOT EXISTS ix_crm_account_vendor_name ON crm_account(vendor_id, name);",
        "CREATE INDEX IF NOT EXISTS ix_crm_account_owner ON crm_account(owner_id);",
        # Contacts
        """CREATE TABLE IF NOT EXISTS crm_contact (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
            account_id UUID REFERENCES crm_account(id) ON DELETE SET NULL,
            customer_id UUID REFERENCES customer(id) ON DELETE SET NULL,
            owner_id UUID REFERENCES "user"(id) ON DELETE SET NULL,
            first_name VARCHAR(120) NOT NULL,
            last_name VARCHAR(120),
            title VARCHAR(120),
            email VARCHAR(255),
            phone VARCHAR(50),
            mobile VARCHAR(50),
            address JSONB DEFAULT '{}'::jsonb,
            tags JSONB DEFAULT '[]'::jsonb,
            custom_fields JSONB DEFAULT '{}'::jsonb,
            notes TEXT,
            lifecycle_stage VARCHAR(40) DEFAULT 'lead',
            lead_source VARCHAR(80),
            do_not_email BOOLEAN DEFAULT FALSE,
            do_not_call BOOLEAN DEFAULT FALSE,
            is_active BOOLEAN DEFAULT TRUE,
            last_activity_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now()
        );""",
        "CREATE INDEX IF NOT EXISTS ix_crm_contact_vendor_id ON crm_contact(vendor_id);",
        "CREATE INDEX IF NOT EXISTS ix_crm_contact_vendor_email ON crm_contact(vendor_id, email);",
        "CREATE INDEX IF NOT EXISTS ix_crm_contact_vendor_phone ON crm_contact(vendor_id, phone);",
        "CREATE INDEX IF NOT EXISTS ix_crm_contact_account ON crm_contact(account_id);",
        "CREATE INDEX IF NOT EXISTS ix_crm_contact_owner ON crm_contact(owner_id);",
        # Pipelines / Stages (need to exist before deals/leads referencing deals)
        """CREATE TABLE IF NOT EXISTS crm_pipeline (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
            name VARCHAR(120) NOT NULL,
            description TEXT,
            is_default BOOLEAN DEFAULT FALSE,
            is_active BOOLEAN DEFAULT TRUE,
            sort_order INTEGER DEFAULT 0,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now()
        );""",
        "CREATE INDEX IF NOT EXISTS ix_crm_pipeline_vendor ON crm_pipeline(vendor_id);",
        """CREATE TABLE IF NOT EXISTS crm_stage (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            pipeline_id UUID NOT NULL REFERENCES crm_pipeline(id) ON DELETE CASCADE,
            vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
            name VARCHAR(120) NOT NULL,
            probability NUMERIC(5,2) DEFAULT 0,
            sort_order INTEGER DEFAULT 0,
            is_won BOOLEAN DEFAULT FALSE,
            is_lost BOOLEAN DEFAULT FALSE,
            color VARCHAR(20),
            created_at TIMESTAMPTZ DEFAULT now()
        );""",
        "CREATE INDEX IF NOT EXISTS ix_crm_stage_pipeline ON crm_stage(pipeline_id);",
        "CREATE INDEX IF NOT EXISTS ix_crm_stage_vendor ON crm_stage(vendor_id);",
        # Deals
        """CREATE TABLE IF NOT EXISTS crm_deal (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
            pipeline_id UUID NOT NULL REFERENCES crm_pipeline(id) ON DELETE RESTRICT,
            stage_id UUID NOT NULL REFERENCES crm_stage(id) ON DELETE RESTRICT,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            account_id UUID REFERENCES crm_account(id) ON DELETE SET NULL,
            contact_id UUID REFERENCES crm_contact(id) ON DELETE SET NULL,
            owner_id UUID REFERENCES "user"(id) ON DELETE SET NULL,
            amount NUMERIC(14,2) DEFAULT 0,
            currency VARCHAR(3) DEFAULT 'INR',
            probability NUMERIC(5,2),
            expected_close_date TIMESTAMPTZ,
            closed_at TIMESTAMPTZ,
            status VARCHAR(20) DEFAULT 'open',
            lost_reason VARCHAR(255),
            won_reason VARCHAR(255),
            source VARCHAR(80),
            sort_order INTEGER DEFAULT 0,
            tags JSONB DEFAULT '[]'::jsonb,
            custom_fields JSONB DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now()
        );""",
        "CREATE INDEX IF NOT EXISTS ix_crm_deal_vendor ON crm_deal(vendor_id);",
        "CREATE INDEX IF NOT EXISTS ix_crm_deal_vendor_stage ON crm_deal(vendor_id, stage_id);",
        "CREATE INDEX IF NOT EXISTS ix_crm_deal_owner ON crm_deal(owner_id);",
        "CREATE INDEX IF NOT EXISTS ix_crm_deal_status ON crm_deal(vendor_id, status);",
        # Leads (after deal/account/contact since FKs)
        """CREATE TABLE IF NOT EXISTS crm_lead (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
            first_name VARCHAR(120),
            last_name VARCHAR(120),
            company VARCHAR(255),
            email VARCHAR(255),
            phone VARCHAR(50),
            title VARCHAR(120),
            website VARCHAR(500),
            source VARCHAR(80),
            source_campaign VARCHAR(255),
            status VARCHAR(40) DEFAULT 'new',
            score INTEGER DEFAULT 0,
            rating VARCHAR(20),
            assigned_to UUID REFERENCES "user"(id) ON DELETE SET NULL,
            notes TEXT,
            intake_payload JSONB DEFAULT '{}'::jsonb,
            custom_fields JSONB DEFAULT '{}'::jsonb,
            tags JSONB DEFAULT '[]'::jsonb,
            converted_at TIMESTAMPTZ,
            converted_contact_id UUID REFERENCES crm_contact(id) ON DELETE SET NULL,
            converted_account_id UUID REFERENCES crm_account(id) ON DELETE SET NULL,
            converted_deal_id UUID REFERENCES crm_deal(id) ON DELETE SET NULL,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now()
        );""",
        "CREATE INDEX IF NOT EXISTS ix_crm_lead_vendor ON crm_lead(vendor_id);",
        "CREATE INDEX IF NOT EXISTS ix_crm_lead_vendor_status ON crm_lead(vendor_id, status);",
        "CREATE INDEX IF NOT EXISTS ix_crm_lead_assigned ON crm_lead(assigned_to);",
        "CREATE INDEX IF NOT EXISTS ix_crm_lead_email ON crm_lead(vendor_id, email);",
        # Activities
        """CREATE TABLE IF NOT EXISTS crm_activity (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
            owner_id UUID REFERENCES "user"(id) ON DELETE SET NULL,
            type VARCHAR(20) NOT NULL,
            subject VARCHAR(255) NOT NULL,
            description TEXT,
            related_type VARCHAR(30),
            related_id UUID,
            due_at TIMESTAMPTZ,
            reminder_at TIMESTAMPTZ,
            completed_at TIMESTAMPTZ,
            duration_minutes INTEGER,
            priority VARCHAR(20) DEFAULT 'normal',
            status VARCHAR(20) DEFAULT 'open',
            location VARCHAR(255),
            meeting_url VARCHAR(500),
            outcome VARCHAR(255),
            custom_fields JSONB DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now()
        );""",
        "CREATE INDEX IF NOT EXISTS ix_crm_activity_vendor ON crm_activity(vendor_id);",
        "CREATE INDEX IF NOT EXISTS ix_crm_activity_vendor_owner ON crm_activity(vendor_id, owner_id);",
        "CREATE INDEX IF NOT EXISTS ix_crm_activity_related ON crm_activity(related_type, related_id);",
        "CREATE INDEX IF NOT EXISTS ix_crm_activity_due ON crm_activity(vendor_id, due_at);",
        # Communication logs
        """CREATE TABLE IF NOT EXISTS crm_communication_log (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
            channel VARCHAR(20) NOT NULL,
            direction VARCHAR(10) DEFAULT 'outbound',
            subject VARCHAR(255),
            body TEXT,
            occurred_at TIMESTAMPTZ DEFAULT now(),
            related_type VARCHAR(30),
            related_id UUID,
            contact_id UUID REFERENCES crm_contact(id) ON DELETE SET NULL,
            recorded_by UUID REFERENCES "user"(id) ON DELETE SET NULL,
            external_id VARCHAR(255),
            provider VARCHAR(40),
            status VARCHAR(40),
            sentiment VARCHAR(20),
            metadata JSONB DEFAULT '{}'::jsonb,
            attachments JSONB DEFAULT '[]'::jsonb
        );""",
        "CREATE INDEX IF NOT EXISTS ix_crm_comm_vendor ON crm_communication_log(vendor_id);",
        "CREATE INDEX IF NOT EXISTS ix_crm_comm_vendor_occurred ON crm_communication_log(vendor_id, occurred_at);",
        "CREATE INDEX IF NOT EXISTS ix_crm_comm_related ON crm_communication_log(related_type, related_id);",
        "CREATE INDEX IF NOT EXISTS ix_crm_comm_contact ON crm_communication_log(contact_id);",
        # Call recordings
        """CREATE TABLE IF NOT EXISTS crm_call_recording (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
            communication_id UUID REFERENCES crm_communication_log(id) ON DELETE CASCADE,
            url VARCHAR(500),
            duration_seconds INTEGER,
            transcript TEXT,
            sentiment VARCHAR(20),
            created_at TIMESTAMPTZ DEFAULT now()
        );""",
        "CREATE INDEX IF NOT EXISTS ix_crm_call_recording_vendor ON crm_call_recording(vendor_id);",
        # SLA Policies
        """CREATE TABLE IF NOT EXISTS crm_sla_policy (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
            name VARCHAR(120) NOT NULL,
            description TEXT,
            priority VARCHAR(20) DEFAULT 'normal',
            response_target_minutes INTEGER DEFAULT 240,
            resolution_target_minutes INTEGER DEFAULT 2880,
            business_hours JSONB DEFAULT '{}'::jsonb,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMPTZ DEFAULT now()
        );""",
        "CREATE INDEX IF NOT EXISTS ix_crm_sla_vendor ON crm_sla_policy(vendor_id);",
        # Tickets
        """CREATE TABLE IF NOT EXISTS crm_ticket (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
            number VARCHAR(40) NOT NULL,
            subject VARCHAR(255) NOT NULL,
            description TEXT,
            contact_id UUID REFERENCES crm_contact(id) ON DELETE SET NULL,
            account_id UUID REFERENCES crm_account(id) ON DELETE SET NULL,
            assigned_to UUID REFERENCES "user"(id) ON DELETE SET NULL,
            sla_policy_id UUID REFERENCES crm_sla_policy(id) ON DELETE SET NULL,
            priority VARCHAR(20) DEFAULT 'normal',
            status VARCHAR(30) DEFAULT 'open',
            source VARCHAR(40) DEFAULT 'manual',
            first_response_at TIMESTAMPTZ,
            resolved_at TIMESTAMPTZ,
            closed_at TIMESTAMPTZ,
            sla_breached BOOLEAN DEFAULT FALSE,
            tags JSONB DEFAULT '[]'::jsonb,
            custom_fields JSONB DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now()
        );""",
        "CREATE INDEX IF NOT EXISTS ix_crm_ticket_vendor ON crm_ticket(vendor_id);",
        "CREATE INDEX IF NOT EXISTS ix_crm_ticket_vendor_status ON crm_ticket(vendor_id, status);",
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_crm_ticket_number ON crm_ticket(vendor_id, number);",
        "CREATE INDEX IF NOT EXISTS ix_crm_ticket_contact ON crm_ticket(contact_id);",
        "CREATE INDEX IF NOT EXISTS ix_crm_ticket_assigned ON crm_ticket(assigned_to);",
        # Ticket comments
        """CREATE TABLE IF NOT EXISTS crm_ticket_comment (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            ticket_id UUID NOT NULL REFERENCES crm_ticket(id) ON DELETE CASCADE,
            vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
            author_id UUID REFERENCES "user"(id) ON DELETE SET NULL,
            contact_id UUID REFERENCES crm_contact(id) ON DELETE SET NULL,
            body TEXT NOT NULL,
            is_internal BOOLEAN DEFAULT FALSE,
            attachments JSONB DEFAULT '[]'::jsonb,
            created_at TIMESTAMPTZ DEFAULT now()
        );""",
        "CREATE INDEX IF NOT EXISTS ix_crm_ticket_comment_ticket ON crm_ticket_comment(ticket_id);",
        # KB articles
        """CREATE TABLE IF NOT EXISTS crm_kb_article (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
            title VARCHAR(255) NOT NULL,
            slug VARCHAR(255) NOT NULL,
            body TEXT,
            summary TEXT,
            tags JSONB DEFAULT '[]'::jsonb,
            status VARCHAR(20) DEFAULT 'draft',
            view_count INTEGER DEFAULT 0,
            helpful_count INTEGER DEFAULT 0,
            author_id UUID REFERENCES "user"(id) ON DELETE SET NULL,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now()
        );""",
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_crm_kb_vendor_slug ON crm_kb_article(vendor_id, slug);",
        "CREATE INDEX IF NOT EXISTS ix_crm_kb_vendor_status ON crm_kb_article(vendor_id, status);",
        # Segments
        """CREATE TABLE IF NOT EXISTS crm_segment (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
            name VARCHAR(120) NOT NULL,
            description TEXT,
            filter_dsl JSONB DEFAULT '{}'::jsonb,
            contact_count INTEGER DEFAULT 0,
            last_computed_at TIMESTAMPTZ,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now()
        );""",
        "CREATE INDEX IF NOT EXISTS ix_crm_segment_vendor ON crm_segment(vendor_id);",
        # Email templates
        """CREATE TABLE IF NOT EXISTS crm_email_template (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
            name VARCHAR(120) NOT NULL,
            subject VARCHAR(255) NOT NULL,
            body_html TEXT NOT NULL,
            body_text TEXT,
            merge_tags JSONB DEFAULT '[]'::jsonb,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now()
        );""",
        "CREATE INDEX IF NOT EXISTS ix_crm_email_template_vendor ON crm_email_template(vendor_id);",
        # Campaigns
        """CREATE TABLE IF NOT EXISTS crm_campaign (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
            name VARCHAR(255) NOT NULL,
            type VARCHAR(30) NOT NULL DEFAULT 'one_off',
            channel VARCHAR(20) DEFAULT 'email',
            status VARCHAR(20) DEFAULT 'draft',
            template_id UUID REFERENCES crm_email_template(id) ON DELETE SET NULL,
            segment_id UUID REFERENCES crm_segment(id) ON DELETE SET NULL,
            scheduled_at TIMESTAMPTZ,
            started_at TIMESTAMPTZ,
            completed_at TIMESTAMPTZ,
            sent_count INTEGER DEFAULT 0,
            open_count INTEGER DEFAULT 0,
            click_count INTEGER DEFAULT 0,
            bounce_count INTEGER DEFAULT 0,
            unsubscribe_count INTEGER DEFAULT 0,
            settings JSONB DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now()
        );""",
        "CREATE INDEX IF NOT EXISTS ix_crm_campaign_vendor ON crm_campaign(vendor_id);",
        "CREATE INDEX IF NOT EXISTS ix_crm_campaign_vendor_status ON crm_campaign(vendor_id, status);",
        # Campaign steps
        """CREATE TABLE IF NOT EXISTS crm_campaign_step (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            campaign_id UUID NOT NULL REFERENCES crm_campaign(id) ON DELETE CASCADE,
            sort_order INTEGER DEFAULT 0,
            delay_minutes INTEGER DEFAULT 0,
            channel VARCHAR(20) DEFAULT 'email',
            template_id UUID REFERENCES crm_email_template(id) ON DELETE SET NULL,
            condition JSONB DEFAULT '{}'::jsonb,
            action JSONB DEFAULT '{}'::jsonb
        );""",
        "CREATE INDEX IF NOT EXISTS ix_crm_campaign_step_campaign ON crm_campaign_step(campaign_id);",
        # Campaign enrollments
        """CREATE TABLE IF NOT EXISTS crm_campaign_enrollment (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            campaign_id UUID NOT NULL REFERENCES crm_campaign(id) ON DELETE CASCADE,
            contact_id UUID NOT NULL REFERENCES crm_contact(id) ON DELETE CASCADE,
            vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
            current_step INTEGER DEFAULT 0,
            status VARCHAR(20) DEFAULT 'active',
            enrolled_at TIMESTAMPTZ DEFAULT now(),
            next_action_at TIMESTAMPTZ,
            last_action_at TIMESTAMPTZ,
            completed_at TIMESTAMPTZ,
            exit_reason VARCHAR(120)
        );""",
        "CREATE INDEX IF NOT EXISTS ix_crm_enrollment_next ON crm_campaign_enrollment(vendor_id, next_action_at);",
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_crm_enrollment_unique ON crm_campaign_enrollment(campaign_id, contact_id);",
        # Email events
        """CREATE TABLE IF NOT EXISTS crm_email_event (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
            campaign_id UUID REFERENCES crm_campaign(id) ON DELETE CASCADE,
            contact_id UUID REFERENCES crm_contact(id) ON DELETE CASCADE,
            event VARCHAR(30) NOT NULL,
            target_url VARCHAR(500),
            user_agent VARCHAR(500),
            ip VARCHAR(50),
            occurred_at TIMESTAMPTZ DEFAULT now()
        );""",
        "CREATE INDEX IF NOT EXISTS ix_crm_email_event_vendor ON crm_email_event(vendor_id);",
        "CREATE INDEX IF NOT EXISTS ix_crm_email_event_campaign ON crm_email_event(campaign_id);",
        "CREATE INDEX IF NOT EXISTS ix_crm_email_event_contact ON crm_email_event(contact_id);",
        # Suppression list
        """CREATE TABLE IF NOT EXISTS crm_suppression_entry (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
            channel VARCHAR(20) NOT NULL,
            address VARCHAR(255) NOT NULL,
            reason VARCHAR(120),
            created_at TIMESTAMPTZ DEFAULT now()
        );""",
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_crm_suppression_unique ON crm_suppression_entry(vendor_id, channel, address);",
        # Workflows
        """CREATE TABLE IF NOT EXISTS crm_workflow (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
            name VARCHAR(255) NOT NULL,
            description TEXT,
            trigger JSONB DEFAULT '{}'::jsonb,
            steps JSONB DEFAULT '[]'::jsonb,
            status VARCHAR(20) DEFAULT 'active',
            requires_approval BOOLEAN DEFAULT FALSE,
            last_run_at TIMESTAMPTZ,
            run_count INTEGER DEFAULT 0,
            success_count INTEGER DEFAULT 0,
            failure_count INTEGER DEFAULT 0,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now()
        );""",
        "CREATE INDEX IF NOT EXISTS ix_crm_workflow_vendor ON crm_workflow(vendor_id);",
        # Workflow runs
        """CREATE TABLE IF NOT EXISTS crm_workflow_run (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            workflow_id UUID NOT NULL REFERENCES crm_workflow(id) ON DELETE CASCADE,
            vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
            entity_type VARCHAR(40),
            entity_id UUID,
            status VARCHAR(20) DEFAULT 'running',
            log JSONB DEFAULT '[]'::jsonb,
            error TEXT,
            approved_by UUID REFERENCES "user"(id) ON DELETE SET NULL,
            approved_at TIMESTAMPTZ,
            started_at TIMESTAMPTZ DEFAULT now(),
            finished_at TIMESTAMPTZ
        );""",
        "CREATE INDEX IF NOT EXISTS ix_crm_workflow_run_workflow ON crm_workflow_run(workflow_id);",
        "CREATE INDEX IF NOT EXISTS ix_crm_workflow_run_vendor ON crm_workflow_run(vendor_id);",
        # Integrations
        """CREATE TABLE IF NOT EXISTS crm_integration (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
            provider VARCHAR(40) NOT NULL,
            label VARCHAR(120),
            status VARCHAR(20) DEFAULT 'connected',
            encrypted_credentials TEXT,
            settings JSONB DEFAULT '{}'::jsonb,
            last_synced_at TIMESTAMPTZ,
            last_error TEXT,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now()
        );""",
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_crm_integration_vendor_provider ON crm_integration(vendor_id, provider);",
        # Audit log
        """CREATE TABLE IF NOT EXISTS crm_audit_log (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
            actor_id UUID REFERENCES "user"(id) ON DELETE SET NULL,
            actor_type VARCHAR(20) DEFAULT 'user',
            entity VARCHAR(60) NOT NULL,
            entity_id UUID,
            action VARCHAR(40) NOT NULL,
            before JSONB,
            after JSONB,
            ip VARCHAR(50),
            user_agent VARCHAR(500),
            request_path VARCHAR(500),
            created_at TIMESTAMPTZ DEFAULT now()
        );""",
        "CREATE INDEX IF NOT EXISTS ix_crm_audit_vendor_created ON crm_audit_log(vendor_id, created_at);",
        "CREATE INDEX IF NOT EXISTS ix_crm_audit_entity ON crm_audit_log(entity, entity_id);",
        # AI insights
        """CREATE TABLE IF NOT EXISTS crm_ai_insight (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
            entity_type VARCHAR(40) NOT NULL,
            entity_id UUID NOT NULL,
            kind VARCHAR(40) NOT NULL,
            content JSONB DEFAULT '{}'::jsonb,
            model VARCHAR(80),
            confidence NUMERIC(5,2),
            generated_at TIMESTAMPTZ DEFAULT now(),
            expires_at TIMESTAMPTZ
        );""",
        "CREATE INDEX IF NOT EXISTS ix_crm_ai_entity ON crm_ai_insight(entity_type, entity_id);",
        "CREATE INDEX IF NOT EXISTS ix_crm_ai_vendor_kind ON crm_ai_insight(vendor_id, kind);",
        # Chat conversations
        """CREATE TABLE IF NOT EXISTS crm_chat_conversation (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
            contact_id UUID REFERENCES crm_contact(id) ON DELETE SET NULL,
            customer_id UUID REFERENCES customer(id) ON DELETE SET NULL,
            visitor_id VARCHAR(120),
            visitor_name VARCHAR(120),
            visitor_email VARCHAR(255),
            channel VARCHAR(20) DEFAULT 'widget',
            status VARCHAR(20) DEFAULT 'open',
            assigned_to UUID REFERENCES "user"(id) ON DELETE SET NULL,
            bot_handled BOOLEAN DEFAULT TRUE,
            last_message_at TIMESTAMPTZ DEFAULT now(),
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now()
        );""",
        "CREATE INDEX IF NOT EXISTS ix_crm_chat_conv_vendor ON crm_chat_conversation(vendor_id);",
        "CREATE INDEX IF NOT EXISTS ix_crm_chat_conv_vendor_status ON crm_chat_conversation(vendor_id, status);",
        "CREATE INDEX IF NOT EXISTS ix_crm_chat_conv_visitor ON crm_chat_conversation(vendor_id, visitor_id);",
        # Chat messages
        """CREATE TABLE IF NOT EXISTS crm_chat_message (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            conversation_id UUID NOT NULL REFERENCES crm_chat_conversation(id) ON DELETE CASCADE,
            vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
            sender VARCHAR(20) NOT NULL,
            sender_id UUID,
            body TEXT,
            attachments JSONB DEFAULT '[]'::jsonb,
            metadata JSONB DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ DEFAULT now()
        );""",
        "CREATE INDEX IF NOT EXISTS ix_crm_chat_msg_conv ON crm_chat_message(conversation_id);",
        # Journey events
        """CREATE TABLE IF NOT EXISTS crm_journey_event (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
            contact_id UUID REFERENCES crm_contact(id) ON DELETE SET NULL,
            customer_id UUID REFERENCES customer(id) ON DELETE SET NULL,
            visitor_id VARCHAR(120),
            event_type VARCHAR(60) NOT NULL,
            payload JSONB DEFAULT '{}'::jsonb,
            occurred_at TIMESTAMPTZ DEFAULT now()
        );""",
        "CREATE INDEX IF NOT EXISTS ix_crm_journey_vendor_time ON crm_journey_event(vendor_id, occurred_at);",
        "CREATE INDEX IF NOT EXISTS ix_crm_journey_contact ON crm_journey_event(contact_id);",
        "CREATE INDEX IF NOT EXISTS ix_crm_journey_visitor ON crm_journey_event(vendor_id, visitor_id);",
        # Lead intake tokens
        """CREATE TABLE IF NOT EXISTS crm_lead_intake_token (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
            token VARCHAR(64) NOT NULL UNIQUE,
            label VARCHAR(120),
            source_default VARCHAR(80) DEFAULT 'form',
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMPTZ DEFAULT now(),
            last_used_at TIMESTAMPTZ
        );""",
        "CREATE INDEX IF NOT EXISTS ix_crm_intake_token ON crm_lead_intake_token(token);",
        "CREATE INDEX IF NOT EXISTS ix_crm_intake_vendor ON crm_lead_intake_token(vendor_id);",
    ]
    async with engine.begin() as conn:
        for s in stmts:
            await conn.execute(text(s))
        await conn.execute(text(
            "ALTER TABLE crm_activity ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}'::jsonb;"
        ))
        for col_sql in (
            "ALTER TABLE crm_contact ADD COLUMN IF NOT EXISTS record_type VARCHAR(10) DEFAULT 'person';",
            "ALTER TABLE crm_contact ADD COLUMN IF NOT EXISTS salutation VARCHAR(20);",
            "ALTER TABLE crm_contact ADD COLUMN IF NOT EXISTS parent_contact_id UUID REFERENCES crm_contact(id) ON DELETE SET NULL;",
            "ALTER TABLE crm_contact ADD COLUMN IF NOT EXISTS linked_account_id UUID REFERENCES crm_account(id) ON DELETE SET NULL;",
            "ALTER TABLE crm_contact ADD COLUMN IF NOT EXISTS number VARCHAR(40);",
            "ALTER TABLE crm_contact ADD COLUMN IF NOT EXISTS industry VARCHAR(100);",
            "ALTER TABLE crm_contact ADD COLUMN IF NOT EXISTS region VARCHAR(100);",
            "ALTER TABLE crm_contact ADD COLUMN IF NOT EXISTS website VARCHAR(500);",
            "ALTER TABLE crm_contact ADD COLUMN IF NOT EXISTS annual_revenue NUMERIC(14,2);",
            "ALTER TABLE crm_contact ADD COLUMN IF NOT EXISTS employee_count INTEGER;",
            "UPDATE crm_contact SET record_type = 'person' WHERE record_type IS NULL;",
            "CREATE INDEX IF NOT EXISTS ix_crm_contact_parent ON crm_contact(parent_contact_id);",
            "CREATE INDEX IF NOT EXISTS ix_crm_contact_record_type ON crm_contact(vendor_id, record_type);",
        ):
            await conn.execute(text(col_sql))
        # Account → contact migration reads a.number; ensure column exists first.
        await conn.execute(text(
            "ALTER TABLE crm_account ADD COLUMN IF NOT EXISTS number VARCHAR(40);"
        ))
        for col_sql in (
            "ALTER TABLE crm_email_template ADD COLUMN IF NOT EXISTS channel VARCHAR(20) DEFAULT 'email';",
            "ALTER TABLE crm_email_template ADD COLUMN IF NOT EXISTS description TEXT;",
            "ALTER TABLE crm_email_template ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;",
            "ALTER TABLE crm_email_template ADD COLUMN IF NOT EXISTS schedule_start TIMESTAMPTZ;",
            "ALTER TABLE crm_email_template ADD COLUMN IF NOT EXISTS schedule_end TIMESTAMPTZ;",
            "ALTER TABLE crm_email_template ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;",
            "UPDATE crm_email_template SET schedule_start = scheduled_at WHERE schedule_start IS NULL AND scheduled_at IS NOT NULL;",
            "ALTER TABLE crm_email_template ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb;",
        ):
            await conn.execute(text(col_sql))
        await conn.execute(text("""
            INSERT INTO crm_contact (
                vendor_id, first_name, record_type, industry, region, website, phone, email,
                annual_revenue, employee_count, tags, custom_fields, notes, owner_id, is_active,
                linked_account_id, number, lifecycle_stage, created_at, updated_at
            )
            SELECT
                a.vendor_id, a.name, 'company', a.industry, a.region, a.website, a.phone, a.email,
                a.annual_revenue, a.employee_count, a.tags, a.custom_fields, a.notes, a.owner_id, a.is_active,
                a.id, a.number, 'customer', a.created_at, a.updated_at
            FROM crm_account a
            WHERE NOT EXISTS (SELECT 1 FROM crm_contact c WHERE c.linked_account_id = a.id);
        """))
        await conn.execute(text("""
            UPDATE crm_contact p
            SET parent_contact_id = co.id
            FROM crm_contact co
            WHERE p.account_id IS NOT NULL
              AND co.linked_account_id = p.account_id
              AND co.record_type = 'company'
              AND p.record_type = 'person'
              AND p.parent_contact_id IS NULL;
        """))
        for table, prefix in (
            ("crm_account", "ACC"),
            ("crm_lead", "LED"),
            ("crm_deal", "DEAL"),
            ("crm_activity", "TSK"),
        ):
            await conn.execute(text(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS number VARCHAR(40);"))
            await conn.execute(text(f"""
                WITH numbered AS (
                    SELECT id,
                        ROW_NUMBER() OVER (PARTITION BY vendor_id ORDER BY created_at, id) AS rn
                    FROM {table}
                    WHERE number IS NULL
                )
                UPDATE {table} t
                SET number = '{prefix}-' || LPAD(numbered.rn::text, 6, '0')
                FROM numbered
                WHERE t.id = numbered.id;
            """))
            await conn.execute(text(
                f"CREATE UNIQUE INDEX IF NOT EXISTS ix_{table}_number ON {table}(vendor_id, number);"
            ))


async def ensure_pos_transaction_accounting_columns() -> None:
    """Add document/posting dates and period labels on pos_transaction (ORM fields)."""
    if "postgresql" not in settings.DATABASE_URL.lower():
        return
    stmts = [
        "ALTER TABLE pos_transaction ADD COLUMN IF NOT EXISTS document_date DATE",
        "ALTER TABLE pos_transaction ADD COLUMN IF NOT EXISTS posting_date DATE",
        "ALTER TABLE pos_transaction ADD COLUMN IF NOT EXISTS fiscal_year VARCHAR(64)",
        "ALTER TABLE pos_transaction ADD COLUMN IF NOT EXISTS accounting_period VARCHAR(64)",
        "ALTER TABLE pos_transaction ADD COLUMN IF NOT EXISTS sales_person_vendor_user_id UUID REFERENCES vendor_user(id) ON DELETE SET NULL",
        "CREATE INDEX IF NOT EXISTS ix_pos_txn_sales_person ON pos_transaction(vendor_id, sales_person_vendor_user_id)",
    ]
    async with engine.begin() as conn:
        for s in stmts:
            await conn.execute(text(s))


async def ensure_fiscal_year_schema() -> None:
    """
    Align fin_fiscal_year / fin_period with app.models.finance when Alembic fin005–fin007
    was not applied (e.g. restored dump, wrong DB). Idempotent; mirrors fin007_fiscal_schema_repair.
    """
    if "postgresql" not in settings.DATABASE_URL.lower():
        return

    async def _table_exists(conn, table: str) -> bool:
        r = await conn.execute(
            text(
                "SELECT 1 FROM information_schema.tables "
                "WHERE table_schema = 'public' AND table_name = :t"
            ),
            {"t": table},
        )
        return r.first() is not None

    async def _has_col(conn, table: str, col: str) -> bool:
        r = await conn.execute(
            text(
                "SELECT 1 FROM information_schema.columns "
                "WHERE table_schema = 'public' AND table_name = :t AND column_name = :c"
            ),
            {"t": table, "c": col},
        )
        return r.first() is not None

    async def _constraint_exists(conn, name: str) -> bool:
        r = await conn.execute(text("SELECT 1 FROM pg_constraint WHERE conname = :n"), {"n": name})
        return r.first() is not None

    async with engine.begin() as conn:
        if not await _table_exists(conn, "fin_fiscal_year"):
            return

        # fin004: period_kind
        if await _table_exists(conn, "fin_period") and not await _has_col(conn, "fin_period", "period_kind"):
            await conn.execute(
                text(
                    "ALTER TABLE fin_period ADD COLUMN period_kind VARCHAR(20) NOT NULL DEFAULT 'standard'"
                )
            )
            await conn.execute(text("ALTER TABLE fin_period DROP CONSTRAINT IF EXISTS ck_fin_period_kind"))
            await conn.execute(
                text(
                    "ALTER TABLE fin_period ADD CONSTRAINT ck_fin_period_kind "
                    "CHECK (period_kind IN ('standard', 'audit'))"
                )
            )

        fin006_ok = (
            await _table_exists(conn, "fin_fiscal_year_company")
            and not await _has_col(conn, "fin_fiscal_year", "company_id")
            and await _has_col(conn, "fin_fiscal_year", "variant_code")
        )
        if fin006_ok:
            return

        logger.warning(
            "Applying runtime fiscal schema repair (variant_code / fin_fiscal_year_company). "
            "Prefer: alembic upgrade head (fin007_fiscal_schema_repair)."
        )

        if not await _has_col(conn, "fin_fiscal_year", "company_id"):
            await conn.execute(
                text(
                    "ALTER TABLE fin_fiscal_year ADD COLUMN company_id "
                    "UUID REFERENCES fin_company(id) ON DELETE RESTRICT"
                )
            )
        if not await _has_col(conn, "fin_fiscal_year", "variant_code"):
            await conn.execute(text("ALTER TABLE fin_fiscal_year ADD COLUMN variant_code VARCHAR(40)"))

        await conn.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_fin_fiscal_year_vendor_company "
                "ON fin_fiscal_year(vendor_id, company_id)"
            )
        )
        await conn.execute(
            text(
                """
                UPDATE fin_fiscal_year fy
                SET company_id = (
                    SELECT c.id FROM fin_company c
                    WHERE c.vendor_id = fy.vendor_id AND c.is_default = TRUE
                    LIMIT 1
                )
                WHERE company_id IS NULL
                """
            )
        )
        await conn.execute(
            text(
                """
                UPDATE fin_fiscal_year fy
                SET company_id = (
                    SELECT c.id FROM fin_company c
                    WHERE c.vendor_id = fy.vendor_id
                    ORDER BY c.code
                    LIMIT 1
                )
                WHERE company_id IS NULL
                """
            )
        )
        await conn.execute(
            text(
                """
                INSERT INTO fin_company (vendor_id, code, name, is_default, is_active, currency, country, address)
                SELECT v.id, '1000', v.business_name, TRUE, TRUE, 'INR', 'IN', '{}'::jsonb
                FROM vendor v
                WHERE v.id IN (SELECT vendor_id FROM fin_fiscal_year WHERE company_id IS NULL)
                AND v.id NOT IN (SELECT vendor_id FROM fin_company)
                ON CONFLICT (vendor_id, code) DO NOTHING
                """
            )
        )
        await conn.execute(
            text(
                """
                UPDATE fin_fiscal_year fy
                SET company_id = (
                    SELECT c.id FROM fin_company c
                    WHERE c.vendor_id = fy.vendor_id
                    ORDER BY c.is_default DESC, c.code
                    LIMIT 1
                )
                WHERE company_id IS NULL
                """
            )
        )
        await conn.execute(
            text(
                """
                UPDATE fin_fiscal_year
                SET variant_code = 'V' || REPLACE(CAST(id AS TEXT), '-', '')
                WHERE variant_code IS NULL
                """
            )
        )
        await conn.execute(text("ALTER TABLE fin_fiscal_year ALTER COLUMN variant_code SET NOT NULL"))
        n = (
            await conn.execute(text("SELECT count(*) FROM fin_fiscal_year WHERE company_id IS NULL"))
        ).scalar()
        if n and int(n) > 0:
            raise RuntimeError(
                f"ensure_fiscal_year_schema: {n} fin_fiscal_year row(s) have no company_id; add fin_company rows."
            )
        await conn.execute(text("ALTER TABLE fin_fiscal_year ALTER COLUMN company_id SET NOT NULL"))
        if not await _constraint_exists(conn, "uq_fin_fy_vendor_company_variant"):
            await conn.execute(
                text(
                    """
                    ALTER TABLE fin_fiscal_year ADD CONSTRAINT uq_fin_fy_vendor_company_variant
                    UNIQUE (vendor_id, company_id, variant_code)
                    """
                )
            )

        await conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS fin_fiscal_year_company (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
                    fiscal_year_id UUID NOT NULL REFERENCES fin_fiscal_year(id) ON DELETE CASCADE,
                    company_id UUID NOT NULL REFERENCES fin_company(id) ON DELETE RESTRICT,
                    is_current BOOLEAN NOT NULL DEFAULT FALSE,
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    CONSTRAINT uq_fin_fy_co_fy_company UNIQUE (fiscal_year_id, company_id)
                )
                """
            )
        )
        await conn.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_fin_fy_co_vendor_company "
                "ON fin_fiscal_year_company(vendor_id, company_id)"
            )
        )
        await conn.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_fin_fy_co_fiscal_year "
                "ON fin_fiscal_year_company(fiscal_year_id)"
            )
        )
        is_current_sql = (
            "COALESCE(f.is_current, false)"
            if await _has_col(conn, "fin_fiscal_year", "is_current")
            else "false"
        )
        await conn.execute(
            text(
                f"""
                INSERT INTO fin_fiscal_year_company (id, vendor_id, fiscal_year_id, company_id, is_current)
                SELECT gen_random_uuid(), f.vendor_id, f.id, f.company_id, {is_current_sql}
                FROM fin_fiscal_year f
                WHERE NOT EXISTS (
                    SELECT 1 FROM fin_fiscal_year_company c WHERE c.fiscal_year_id = f.id
                )
                """
            )
        )
        await conn.execute(text("ALTER TABLE fin_fiscal_year DROP CONSTRAINT IF EXISTS uq_fin_fy_vendor_company_variant"))
        await conn.execute(
            text(
                """
                UPDATE fin_fiscal_year f
                SET variant_code = f.variant_code || '_D' || SUBSTRING(REPLACE(f.id::text, '-', ''), 1, 8)
                WHERE id IN (
                    SELECT id FROM (
                        SELECT id,
                            ROW_NUMBER() OVER (
                                PARTITION BY vendor_id, variant_code
                                ORDER BY created_at NULLS LAST, id
                            ) AS rn
                        FROM fin_fiscal_year
                    ) t WHERE t.rn > 1
                )
                """
            )
        )
        await conn.execute(
            text("ALTER TABLE fin_fiscal_year DROP CONSTRAINT IF EXISTS fin_fiscal_year_company_id_fkey")
        )
        await conn.execute(text("DROP INDEX IF EXISTS ix_fin_fiscal_year_vendor_company"))
        await conn.execute(text("ALTER TABLE fin_fiscal_year DROP COLUMN IF EXISTS company_id"))
        await conn.execute(text("ALTER TABLE fin_fiscal_year DROP COLUMN IF EXISTS is_current"))
        if not await _constraint_exists(conn, "uq_fin_fy_vendor_variant"):
            await conn.execute(
                text(
                    """
                    ALTER TABLE fin_fiscal_year ADD CONSTRAINT uq_fin_fy_vendor_variant
                    UNIQUE (vendor_id, variant_code)
                    """
                )
            )


# Redis (optional)
redis_client = None


async def connect_redis():
    global redis_client
    try:
        from redis import asyncio as aioredis

        redis_client = await aioredis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
        )
        await redis_client.ping()
        print("Redis connected")
    except Exception as e:
        print(f"Redis not available: {e}. App will run without caching.")
        redis_client = None


async def close_redis():
    global redis_client
    if redis_client:
        await redis_client.close()


async def get_redis():
    return redis_client


async def ensure_website_tables() -> None:
    """Create website builder tables if they don't already exist. Idempotent."""
    if "postgresql" not in settings.DATABASE_URL.lower():
        return
    stmts = [
        """
        CREATE TABLE IF NOT EXISTS wb_sites (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
            name VARCHAR(200) NOT NULL,
            subdomain VARCHAR(100) UNIQUE,
            custom_domain VARCHAR(255),
            description TEXT,
            favicon_url VARCHAR(500),
            logo_url VARCHAR(500),
            style_config JSONB NOT NULL DEFAULT '{}',
            seo_title VARCHAR(200),
            seo_description TEXT,
            seo_keywords VARCHAR(500),
            og_image_url VARCHAR(500),
            is_published BOOLEAN NOT NULL DEFAULT FALSE,
            published_at TIMESTAMP,
            status VARCHAR(50) NOT NULL DEFAULT 'draft',
            google_analytics_id VARCHAR(50),
            meta_pixel_id VARCHAR(50),
            custom_head_code TEXT,
            custom_body_code TEXT,
            created_at TIMESTAMP NOT NULL DEFAULT now(),
            updated_at TIMESTAMP NOT NULL DEFAULT now()
        )
        """,
        "CREATE INDEX IF NOT EXISTS idx_wb_sites_vendor ON wb_sites(vendor_id)",
        """
        CREATE TABLE IF NOT EXISTS wb_pages (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            site_id UUID NOT NULL REFERENCES wb_sites(id) ON DELETE CASCADE,
            title VARCHAR(200) NOT NULL,
            slug VARCHAR(200) NOT NULL,
            page_type VARCHAR(50) NOT NULL DEFAULT 'custom',
            seo_title VARCHAR(200),
            seo_description TEXT,
            og_image_url VARCHAR(500),
            layout VARCHAR(50) NOT NULL DEFAULT 'full',
            sort_order INTEGER NOT NULL DEFAULT 0,
            is_published BOOLEAN NOT NULL DEFAULT TRUE,
            is_homepage BOOLEAN NOT NULL DEFAULT FALSE,
            show_in_nav BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMP NOT NULL DEFAULT now(),
            updated_at TIMESTAMP NOT NULL DEFAULT now()
        )
        """,
        "CREATE INDEX IF NOT EXISTS idx_wb_pages_site ON wb_pages(site_id)",
        """
        CREATE TABLE IF NOT EXISTS wb_blocks (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            page_id UUID NOT NULL REFERENCES wb_pages(id) ON DELETE CASCADE,
            block_type VARCHAR(100) NOT NULL,
            label VARCHAR(200),
            props JSONB NOT NULL DEFAULT '{}',
            style_overrides JSONB NOT NULL DEFAULT '{}',
            visible BOOLEAN NOT NULL DEFAULT TRUE,
            visible_on_mobile BOOLEAN NOT NULL DEFAULT TRUE,
            visible_on_tablet BOOLEAN NOT NULL DEFAULT TRUE,
            visible_on_desktop BOOLEAN NOT NULL DEFAULT TRUE,
            animation VARCHAR(50),
            animation_delay INTEGER NOT NULL DEFAULT 0,
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMP NOT NULL DEFAULT now(),
            updated_at TIMESTAMP NOT NULL DEFAULT now()
        )
        """,
        "CREATE INDEX IF NOT EXISTS idx_wb_blocks_page ON wb_blocks(page_id)",
        """
        CREATE TABLE IF NOT EXISTS wb_media (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            site_id UUID NOT NULL REFERENCES wb_sites(id) ON DELETE CASCADE,
            vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
            filename VARCHAR(300) NOT NULL,
            original_url VARCHAR(500) NOT NULL,
            adjusted_url VARCHAR(500),
            thumbnail_url VARCHAR(500),
            file_type VARCHAR(50),
            width INTEGER,
            height INTEGER,
            file_size INTEGER,
            adjustments JSONB NOT NULL DEFAULT '{}',
            ai_tags JSONB NOT NULL DEFAULT '[]',
            ai_description TEXT,
            created_at TIMESTAMP NOT NULL DEFAULT now()
        )
        """,
        "CREATE INDEX IF NOT EXISTS idx_wb_media_site ON wb_media(site_id)",

        # ── web002: i18n, currency, location, redirects, headless ────────────
        "ALTER TABLE wb_sites ADD COLUMN IF NOT EXISTS language VARCHAR(10) DEFAULT 'en'",
        "ALTER TABLE wb_sites ADD COLUMN IF NOT EXISTS languages_enabled JSONB DEFAULT '[\"en\"]'",
        "ALTER TABLE wb_sites ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'USD'",
        "ALTER TABLE wb_sites ADD COLUMN IF NOT EXISTS currencies_enabled JSONB DEFAULT '[\"USD\"]'",
        "ALTER TABLE wb_sites ADD COLUMN IF NOT EXISTS currency_symbol VARCHAR(10) DEFAULT '$'",
        "ALTER TABLE wb_sites ADD COLUMN IF NOT EXISTS currency_position VARCHAR(10) DEFAULT 'before'",
        "ALTER TABLE wb_sites ADD COLUMN IF NOT EXISTS location VARCHAR(200)",
        "ALTER TABLE wb_sites ADD COLUMN IF NOT EXISTS timezone VARCHAR(100) DEFAULT 'UTC'",
        "ALTER TABLE wb_sites ADD COLUMN IF NOT EXISTS headless_enabled BOOLEAN DEFAULT FALSE",
        "ALTER TABLE wb_sites ADD COLUMN IF NOT EXISTS headless_token VARCHAR(64)",
        """
        CREATE TABLE IF NOT EXISTS wb_redirects (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            site_id UUID NOT NULL REFERENCES wb_sites(id) ON DELETE CASCADE,
            from_path VARCHAR(500) NOT NULL,
            to_path VARCHAR(500) NOT NULL,
            status_code INTEGER NOT NULL DEFAULT 301,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            hit_count INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMP NOT NULL DEFAULT now()
        )
        """,
        "CREATE INDEX IF NOT EXISTS idx_wb_redirects_site ON wb_redirects(site_id)",

        # ── web003: page types, form submissions, revisions ───────────────────
        "ALTER TABLE wb_pages ADD COLUMN IF NOT EXISTS publish_status VARCHAR(20) DEFAULT 'published'",
        "ALTER TABLE wb_pages ADD COLUMN IF NOT EXISTS scheduled_publish_at TIMESTAMP",
        "ALTER TABLE wb_pages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP",
        "CREATE INDEX IF NOT EXISTS ix_wb_pages_deleted_at ON wb_pages(deleted_at)",
        # ── web007: extended per-page SEO ─────────────────────────────────────
        "ALTER TABLE wb_pages ADD COLUMN IF NOT EXISTS focus_keyword VARCHAR(100)",
        "ALTER TABLE wb_pages ADD COLUMN IF NOT EXISTS seo_keywords VARCHAR(500)",
        "ALTER TABLE wb_pages ADD COLUMN IF NOT EXISTS noindex BOOLEAN NOT NULL DEFAULT FALSE",
        "ALTER TABLE wb_pages ADD COLUMN IF NOT EXISTS og_title VARCHAR(200)",
        "ALTER TABLE wb_pages ADD COLUMN IF NOT EXISTS og_description TEXT",
        "ALTER TABLE wb_pages ADD COLUMN IF NOT EXISTS canonical_url VARCHAR(500)",
        "ALTER TABLE wb_sites ADD COLUMN IF NOT EXISTS schema_org_type VARCHAR(30) NOT NULL DEFAULT 'auto'",
        "ALTER TABLE wb_pages ADD COLUMN IF NOT EXISTS schema_type VARCHAR(30) NOT NULL DEFAULT 'auto'",
        "ALTER TABLE wb_sites ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP",
        "CREATE INDEX IF NOT EXISTS ix_wb_sites_deleted_at ON wb_sites(deleted_at)",
        """
        CREATE TABLE IF NOT EXISTS wb_form_submissions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            site_id UUID NOT NULL REFERENCES wb_sites(id) ON DELETE CASCADE,
            page_id UUID REFERENCES wb_pages(id) ON DELETE SET NULL,
            block_id UUID,
            form_type VARCHAR(50),
            payload JSONB NOT NULL DEFAULT '{}',
            crm_lead_id UUID,
            gdpr_consent BOOLEAN DEFAULT FALSE,
            ip_address VARCHAR(64),
            user_agent TEXT,
            created_at TIMESTAMP NOT NULL DEFAULT now()
        )
        """,
        "CREATE INDEX IF NOT EXISTS idx_wb_form_submissions_site ON wb_form_submissions(site_id)",
        """
        CREATE TABLE IF NOT EXISTS wb_page_revisions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            page_id UUID NOT NULL REFERENCES wb_pages(id) ON DELETE CASCADE,
            site_id UUID NOT NULL,
            snapshot JSONB NOT NULL DEFAULT '{}',
            author_user_id UUID,
            note VARCHAR(500),
            created_at TIMESTAMP NOT NULL DEFAULT now()
        )
        """,
        "CREATE INDEX IF NOT EXISTS idx_wb_page_revisions_page ON wb_page_revisions(page_id)",

        # ── web004: domain SSL ────────────────────────────────────────────────
        "ALTER TABLE wb_sites ADD COLUMN IF NOT EXISTS domain_verification_token VARCHAR(64)",
        "ALTER TABLE wb_sites ADD COLUMN IF NOT EXISTS domain_verified BOOLEAN DEFAULT FALSE",
        "ALTER TABLE wb_sites ADD COLUMN IF NOT EXISTS domain_ssl_status VARCHAR(30)",
        "ALTER TABLE wb_sites ADD COLUMN IF NOT EXISTS domain_ssl_expires_at TIMESTAMP",
        "ALTER TABLE wb_sites ADD COLUMN IF NOT EXISTS feature_flags JSONB DEFAULT '{}'",

        # ── web005: translations, symbols, A/B, webhooks ─────────────────────
        """
        CREATE TABLE IF NOT EXISTS wb_block_translations (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            block_id UUID NOT NULL REFERENCES wb_blocks(id) ON DELETE CASCADE,
            language VARCHAR(10) NOT NULL,
            props_override JSONB NOT NULL DEFAULT '{}',
            created_at TIMESTAMP NOT NULL DEFAULT now(),
            updated_at TIMESTAMP NOT NULL DEFAULT now()
        )
        """,
        "CREATE INDEX IF NOT EXISTS idx_wb_block_translations_block ON wb_block_translations(block_id)",
        """
        CREATE TABLE IF NOT EXISTS wb_symbols (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            vendor_id UUID NOT NULL,
            name VARCHAR(200) NOT NULL,
            description TEXT,
            snapshot JSONB NOT NULL DEFAULT '{}',
            thumbnail_url VARCHAR(500),
            created_at TIMESTAMP NOT NULL DEFAULT now(),
            updated_at TIMESTAMP NOT NULL DEFAULT now()
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS wb_ab_exposures (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            site_id UUID NOT NULL,
            block_id UUID NOT NULL,
            variant VARCHAR(10) NOT NULL,
            session_id VARCHAR(100),
            converted BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP NOT NULL DEFAULT now()
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS wb_webhooks (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            site_id UUID NOT NULL REFERENCES wb_sites(id) ON DELETE CASCADE,
            event VARCHAR(50) NOT NULL,
            url VARCHAR(500) NOT NULL,
            secret VARCHAR(64),
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            last_triggered_at TIMESTAMP,
            last_status_code INTEGER,
            created_at TIMESTAMP NOT NULL DEFAULT now()
        )
        """,
        "CREATE INDEX IF NOT EXISTS idx_wb_webhooks_site ON wb_webhooks(site_id)",
    ]
    async with engine.begin() as conn:
        for s in stmts:
            await conn.execute(text(s))


async def ensure_restaurant_schema() -> None:
    """Restaurant zones/tables + POS kitchen ticket columns (idempotent)."""
    if "postgresql" not in settings.DATABASE_URL.lower():
        return
    stmts = [
        """
        CREATE TABLE IF NOT EXISTS restaurant_zone (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
            name VARCHAR(120) NOT NULL,
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMPTZ DEFAULT now()
        )
        """,
        "CREATE INDEX IF NOT EXISTS ix_restaurant_zone_vendor ON restaurant_zone(vendor_id)",
        """
        CREATE TABLE IF NOT EXISTS restaurant_table (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
            zone_id UUID REFERENCES restaurant_zone(id) ON DELETE SET NULL,
            label VARCHAR(40) NOT NULL,
            capacity INTEGER NOT NULL DEFAULT 4,
            sort_order INTEGER NOT NULL DEFAULT 0,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ DEFAULT now()
        )
        """,
        "CREATE INDEX IF NOT EXISTS ix_restaurant_table_vendor ON restaurant_table(vendor_id)",
        "ALTER TABLE restaurant_table ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'free'",
        "ALTER TABLE pos_transaction ADD COLUMN IF NOT EXISTS restaurant_table_id UUID REFERENCES restaurant_table(id) ON DELETE SET NULL",
        "ALTER TABLE pos_transaction ADD COLUMN IF NOT EXISTS kitchen_ticket_status VARCHAR(20)",
        "CREATE INDEX IF NOT EXISTS ix_pos_txn_kitchen ON pos_transaction(vendor_id, kitchen_ticket_status) WHERE kitchen_ticket_status IS NOT NULL",
        """
        CREATE TABLE IF NOT EXISTS restaurant_order (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
            table_id UUID REFERENCES restaurant_table(id) ON DELETE SET NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'open',
            covers INTEGER NOT NULL DEFAULT 1,
            server_name VARCHAR(120),
            items JSONB NOT NULL DEFAULT '[]'::jsonb,
            notes TEXT,
            pos_transaction_id UUID REFERENCES pos_transaction(id) ON DELETE SET NULL,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now()
        )
        """,
        "CREATE INDEX IF NOT EXISTS ix_restaurant_order_vendor ON restaurant_order(vendor_id)",
        "CREATE INDEX IF NOT EXISTS ix_restaurant_order_table ON restaurant_order(table_id) WHERE status IN ('open','billed')",
        """
        CREATE TABLE IF NOT EXISTS restaurant_kot (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
            order_id UUID NOT NULL REFERENCES restaurant_order(id) ON DELETE CASCADE,
            table_id UUID REFERENCES restaurant_table(id) ON DELETE SET NULL,
            kot_number INTEGER NOT NULL DEFAULT 1,
            status VARCHAR(20) NOT NULL DEFAULT 'new',
            items JSONB NOT NULL DEFAULT '[]'::jsonb,
            notes TEXT,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now()
        )
        """,
        "CREATE INDEX IF NOT EXISTS ix_restaurant_kot_vendor ON restaurant_kot(vendor_id)",
        "CREATE INDEX IF NOT EXISTS ix_restaurant_kot_order ON restaurant_kot(order_id)",
    ]
    async with engine.begin() as conn:
        for s in stmts:
            await conn.execute(text(s))


async def ensure_modifier_schema() -> None:
    """Product modifier groups/options + POS tip/service_charge columns (idempotent)."""
    if "postgresql" not in settings.DATABASE_URL.lower():
        return
    stmts = [
        """
        CREATE TABLE IF NOT EXISTS product_modifier_group (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
            product_id UUID NOT NULL REFERENCES product(id) ON DELETE CASCADE,
            name VARCHAR(120) NOT NULL,
            selection_type VARCHAR(20) NOT NULL DEFAULT 'single',
            is_required BOOLEAN NOT NULL DEFAULT false,
            min_select INTEGER NOT NULL DEFAULT 0,
            max_select INTEGER NOT NULL DEFAULT 1,
            sort_order INTEGER NOT NULL DEFAULT 0,
            is_active BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMPTZ DEFAULT now()
        )
        """,
        "CREATE INDEX IF NOT EXISTS ix_product_modifier_group_product ON product_modifier_group(product_id)",
        "CREATE INDEX IF NOT EXISTS ix_product_modifier_group_vendor ON product_modifier_group(vendor_id)",
        """
        CREATE TABLE IF NOT EXISTS product_modifier_option (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
            group_id UUID NOT NULL REFERENCES product_modifier_group(id) ON DELETE CASCADE,
            name VARCHAR(120) NOT NULL,
            price_delta NUMERIC(12,2) NOT NULL DEFAULT 0,
            is_default BOOLEAN NOT NULL DEFAULT false,
            is_active BOOLEAN NOT NULL DEFAULT true,
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMPTZ DEFAULT now()
        )
        """,
        "CREATE INDEX IF NOT EXISTS ix_product_modifier_option_group ON product_modifier_option(group_id)",
        "ALTER TABLE pos_transaction ADD COLUMN IF NOT EXISTS tip_amount NUMERIC(12,2) DEFAULT 0",
        "ALTER TABLE pos_transaction ADD COLUMN IF NOT EXISTS service_charge_amount NUMERIC(12,2) DEFAULT 0",
    ]
    async with engine.begin() as conn:
        for s in stmts:
            await conn.execute(text(s))


async def ensure_reservation_schema() -> None:
    """Restaurant reservation table + qr_token column on restaurant_table (idempotent)."""
    if "postgresql" not in settings.DATABASE_URL.lower():
        return
    stmts = [
        "ALTER TABLE restaurant_table ADD COLUMN IF NOT EXISTS qr_token VARCHAR(80) UNIQUE",
        """
        CREATE TABLE IF NOT EXISTS restaurant_reservation (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
            table_id UUID REFERENCES restaurant_table(id) ON DELETE SET NULL,
            guest_name VARCHAR(200) NOT NULL,
            guest_phone VARCHAR(30),
            guest_email VARCHAR(200),
            reservation_date DATE NOT NULL,
            reservation_time VARCHAR(10) NOT NULL,
            party_size INTEGER NOT NULL DEFAULT 2,
            status VARCHAR(20) NOT NULL DEFAULT 'pending',
            notes TEXT,
            source VARCHAR(20) NOT NULL DEFAULT 'online',
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now()
        )
        """,
        "CREATE INDEX IF NOT EXISTS ix_restaurant_reservation_vendor_date ON restaurant_reservation(vendor_id, reservation_date)",
    ]
    async with engine.begin() as conn:
        for s in stmts:
            await conn.execute(text(s))


async def ensure_restaurant_order_adjustments() -> None:
    """Add adjustments JSONB column to restaurant_order (idempotent)."""
    if "postgresql" not in settings.DATABASE_URL.lower():
        return
    async with engine.begin() as conn:
        await conn.execute(text(
            "ALTER TABLE restaurant_order ADD COLUMN IF NOT EXISTS adjustments JSONB DEFAULT '{}'::jsonb"
        ))


async def ensure_restaurant_outlet_schema() -> None:
    """Create restaurant outlet table + add restaurant_id/floor to existing restaurant tables (idempotent)."""
    if "postgresql" not in settings.DATABASE_URL.lower():
        return
    stmts = [
        # Core outlet table
        """
        CREATE TABLE IF NOT EXISTS restaurant (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
            store_id UUID NOT NULL REFERENCES store(id) ON DELETE CASCADE,
            name VARCHAR(200) NOT NULL,
            code VARCHAR(50),
            cuisine VARCHAR(120),
            phone VARCHAR(20),
            email VARCHAR(255),
            address JSONB DEFAULT '{}'::jsonb,
            settings JSONB DEFAULT '{}'::jsonb,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            is_default BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now()
        )
        """,
        "CREATE INDEX IF NOT EXISTS ix_restaurant_vendor ON restaurant(vendor_id)",
        "CREATE INDEX IF NOT EXISTS ix_restaurant_store ON restaurant(store_id)",
        # Add restaurant_id and floor to existing tables
        "ALTER TABLE restaurant_zone ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES restaurant(id) ON DELETE CASCADE",
        "CREATE INDEX IF NOT EXISTS ix_restaurant_zone_rid ON restaurant_zone(restaurant_id) WHERE restaurant_id IS NOT NULL",
        "ALTER TABLE restaurant_zone ADD COLUMN IF NOT EXISTS floor VARCHAR(40)",
        "ALTER TABLE restaurant_table ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES restaurant(id) ON DELETE CASCADE",
        "CREATE INDEX IF NOT EXISTS ix_restaurant_table_rid ON restaurant_table(restaurant_id) WHERE restaurant_id IS NOT NULL",
        "ALTER TABLE restaurant_order ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES restaurant(id) ON DELETE CASCADE",
        "CREATE INDEX IF NOT EXISTS ix_restaurant_order_rid ON restaurant_order(restaurant_id) WHERE restaurant_id IS NOT NULL",
        "ALTER TABLE restaurant_kot ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES restaurant(id) ON DELETE CASCADE",
        "CREATE INDEX IF NOT EXISTS ix_restaurant_kot_rid ON restaurant_kot(restaurant_id) WHERE restaurant_id IS NOT NULL",
        "ALTER TABLE restaurant_reservation ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES restaurant(id) ON DELETE CASCADE",
        "CREATE INDEX IF NOT EXISTS ix_restaurant_reservation_rid ON restaurant_reservation(restaurant_id) WHERE restaurant_id IS NOT NULL",
    ]
    async with engine.begin() as conn:
        for s in stmts:
            await conn.execute(text(s))
        # Backfill: for each vendor that has zones/tables but no restaurant yet,
        # create one default restaurant under their default store.
        await conn.execute(text("""
            INSERT INTO restaurant (vendor_id, store_id, name, is_default, is_active)
            SELECT DISTINCT
                rz.vendor_id,
                COALESCE(
                    (SELECT id FROM store WHERE vendor_id = rz.vendor_id AND is_default = TRUE LIMIT 1),
                    (SELECT id FROM store WHERE vendor_id = rz.vendor_id ORDER BY created_at LIMIT 1)
                ) AS store_id,
                'Main Restaurant' AS name,
                TRUE AS is_default,
                TRUE AS is_active
            FROM restaurant_zone rz
            WHERE NOT EXISTS (
                SELECT 1 FROM restaurant r WHERE r.vendor_id = rz.vendor_id
            )
            AND EXISTS (
                SELECT 1 FROM store s WHERE s.vendor_id = rz.vendor_id
            )
            ON CONFLICT DO NOTHING
        """))
        # Assign the default restaurant to all existing untagged rows
        await conn.execute(text("""
            UPDATE restaurant_zone rz
            SET restaurant_id = r.id
            FROM restaurant r
            WHERE r.vendor_id = rz.vendor_id AND r.is_default = TRUE AND rz.restaurant_id IS NULL
        """))
        await conn.execute(text("""
            UPDATE restaurant_table rt
            SET restaurant_id = r.id
            FROM restaurant r
            WHERE r.vendor_id = rt.vendor_id AND r.is_default = TRUE AND rt.restaurant_id IS NULL
        """))
        await conn.execute(text("""
            UPDATE restaurant_order ro
            SET restaurant_id = r.id
            FROM restaurant r
            WHERE r.vendor_id = ro.vendor_id AND r.is_default = TRUE AND ro.restaurant_id IS NULL
        """))
        await conn.execute(text("""
            UPDATE restaurant_kot rk
            SET restaurant_id = r.id
            FROM restaurant r
            WHERE r.vendor_id = rk.vendor_id AND r.is_default = TRUE AND rk.restaurant_id IS NULL
        """))
        await conn.execute(text("""
            UPDATE restaurant_reservation rr
            SET restaurant_id = r.id
            FROM restaurant r
            WHERE r.vendor_id = rr.vendor_id AND r.is_default = TRUE AND rr.restaurant_id IS NULL
        """))


async def ensure_purchase_requisition_schema() -> None:
    """Create purchase requisition tables and backfill columns missing from older schemas (idempotent)."""
    if "postgresql" not in settings.DATABASE_URL.lower():
        return
    stmts = [
        """
        CREATE TABLE IF NOT EXISTS purchase_requisition (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
            pr_number VARCHAR(30) NOT NULL,
            status VARCHAR(30) NOT NULL DEFAULT 'draft',
            requested_by UUID REFERENCES vendor_user(id) ON DELETE SET NULL,
            department VARCHAR(100),
            priority VARCHAR(20) DEFAULT 'medium',
            requisition_type VARCHAR(20) DEFAULT 'product',
            store_id UUID REFERENCES store(id) ON DELETE SET NULL,
            procurement_source VARCHAR(20) DEFAULT 'supplier',
            bu_scope VARCHAR(20),
            from_store_id UUID REFERENCES store(id) ON DELETE SET NULL,
            to_store_id UUID REFERENCES store(id) ON DELETE SET NULL,
            header_supplier_id UUID REFERENCES supplier(id) ON DELETE SET NULL,
            notes TEXT,
            approver_message TEXT,
            audit_log JSONB DEFAULT '[]'::jsonb,
            submitted_at TIMESTAMPTZ,
            approved_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now(),
            CONSTRAINT uq_pr_vendor_number UNIQUE (vendor_id, pr_number)
        )
        """,
        "CREATE INDEX IF NOT EXISTS ix_pr_vendor ON purchase_requisition(vendor_id)",
        "CREATE INDEX IF NOT EXISTS ix_pr_vendor_status ON purchase_requisition(vendor_id, status)",
        "CREATE INDEX IF NOT EXISTS ix_pr_store ON purchase_requisition(store_id)",
        """
        CREATE TABLE IF NOT EXISTS purchase_requisition_item (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            requisition_id UUID NOT NULL REFERENCES purchase_requisition(id) ON DELETE CASCADE,
            item_type VARCHAR(20) DEFAULT 'product',
            product_id UUID REFERENCES product(id) ON DELETE RESTRICT,
            service_id UUID REFERENCES service(id) ON DELETE RESTRICT,
            variant_id UUID REFERENCES product_variant(id) ON DELETE SET NULL,
            description TEXT,
            asset_category_id UUID REFERENCES fin_asset_category(id) ON DELETE SET NULL,
            quantity NUMERIC(12, 4) NOT NULL,
            unit_of_measure VARCHAR(20) DEFAULT 'PCS',
            needed_by_date DATE,
            plant_id UUID REFERENCES plant(id) ON DELETE SET NULL,
            storage_location_id UUID REFERENCES storage_location(id) ON DELETE SET NULL,
            estimated_price NUMERIC(12, 2) DEFAULT 0,
            suggested_supplier_id UUID REFERENCES supplier(id) ON DELETE SET NULL,
            quantity_ordered NUMERIC(12, 4) DEFAULT 0,
            purchase_order_id UUID REFERENCES purchase_order(id) ON DELETE SET NULL,
            is_converted BOOLEAN DEFAULT FALSE,
            notes TEXT
        )
        """,
        "CREATE INDEX IF NOT EXISTS ix_pri_requisition ON purchase_requisition_item(requisition_id)",
        "CREATE INDEX IF NOT EXISTS ix_pri_product ON purchase_requisition_item(product_id)",
        """
        CREATE TABLE IF NOT EXISTS purchase_requisition_approval (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            requisition_id UUID NOT NULL REFERENCES purchase_requisition(id) ON DELETE CASCADE,
            level INTEGER NOT NULL DEFAULT 1,
            approver_id UUID REFERENCES vendor_user(id) ON DELETE SET NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'pending',
            comments TEXT,
            actioned_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT now()
        )
        """,
        "CREATE INDEX IF NOT EXISTS ix_pra_requisition ON purchase_requisition_approval(requisition_id)",
        "CREATE INDEX IF NOT EXISTS ix_pra_approver ON purchase_requisition_approval(approver_id)",
        # Backfill header columns on tables created before proc001/proc002
        "ALTER TABLE purchase_requisition ADD COLUMN IF NOT EXISTS department VARCHAR(100)",
        "ALTER TABLE purchase_requisition ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'medium'",
        "ALTER TABLE purchase_requisition ADD COLUMN IF NOT EXISTS requisition_type VARCHAR(20) DEFAULT 'product'",
        "ALTER TABLE purchase_requisition ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES store(id) ON DELETE SET NULL",
        "ALTER TABLE purchase_requisition ADD COLUMN IF NOT EXISTS procurement_source VARCHAR(20) DEFAULT 'supplier'",
        "ALTER TABLE purchase_requisition ADD COLUMN IF NOT EXISTS bu_scope VARCHAR(20)",
        "ALTER TABLE purchase_requisition ADD COLUMN IF NOT EXISTS from_store_id UUID REFERENCES store(id) ON DELETE SET NULL",
        "ALTER TABLE purchase_requisition ADD COLUMN IF NOT EXISTS to_store_id UUID REFERENCES store(id) ON DELETE SET NULL",
        "ALTER TABLE purchase_requisition ADD COLUMN IF NOT EXISTS header_supplier_id UUID REFERENCES supplier(id) ON DELETE SET NULL",
        "ALTER TABLE purchase_requisition ADD COLUMN IF NOT EXISTS notes TEXT",
        "ALTER TABLE purchase_requisition ADD COLUMN IF NOT EXISTS approver_message TEXT",
        "ALTER TABLE purchase_requisition ADD COLUMN IF NOT EXISTS audit_log JSONB DEFAULT '[]'::jsonb",
        "ALTER TABLE purchase_requisition ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ",
        "ALTER TABLE purchase_requisition ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ",
        # Backfill line-item columns on older purchase_requisition_item tables
        "ALTER TABLE purchase_requisition_item ADD COLUMN IF NOT EXISTS item_type VARCHAR(20) DEFAULT 'product'",
        "ALTER TABLE purchase_requisition_item ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES product_variant(id) ON DELETE SET NULL",
        "ALTER TABLE purchase_requisition_item ADD COLUMN IF NOT EXISTS description TEXT",
        "ALTER TABLE purchase_requisition_item ADD COLUMN IF NOT EXISTS service_id UUID REFERENCES service(id) ON DELETE RESTRICT",
        "ALTER TABLE purchase_requisition_item ADD COLUMN IF NOT EXISTS asset_category_id UUID REFERENCES fin_asset_category(id) ON DELETE SET NULL",
        "ALTER TABLE purchase_requisition_item ADD COLUMN IF NOT EXISTS unit_of_measure VARCHAR(20) DEFAULT 'PCS'",
        "ALTER TABLE purchase_requisition_item ADD COLUMN IF NOT EXISTS needed_by_date DATE",
        "ALTER TABLE purchase_requisition_item ADD COLUMN IF NOT EXISTS plant_id UUID REFERENCES plant(id) ON DELETE SET NULL",
        "ALTER TABLE purchase_requisition_item ADD COLUMN IF NOT EXISTS storage_location_id UUID REFERENCES storage_location(id) ON DELETE SET NULL",
        "ALTER TABLE purchase_requisition_item ADD COLUMN IF NOT EXISTS estimated_price NUMERIC(12, 2) DEFAULT 0",
        "ALTER TABLE purchase_requisition_item ADD COLUMN IF NOT EXISTS suggested_supplier_id UUID REFERENCES supplier(id) ON DELETE SET NULL",
        "ALTER TABLE purchase_requisition_item ADD COLUMN IF NOT EXISTS quantity_ordered NUMERIC(12, 4) DEFAULT 0",
        "ALTER TABLE purchase_requisition_item ADD COLUMN IF NOT EXISTS purchase_order_id UUID REFERENCES purchase_order(id) ON DELETE SET NULL",
        "ALTER TABLE purchase_requisition_item ADD COLUMN IF NOT EXISTS is_converted BOOLEAN DEFAULT FALSE",
        "ALTER TABLE purchase_requisition_item ADD COLUMN IF NOT EXISTS notes TEXT",
    ]
    async with engine.begin() as conn:
        for s in stmts:
            await conn.execute(text(s))


async def ensure_pm_tables() -> None:
    """Create project management tables (pm_project, pm_task) if they don't exist."""
    if "postgresql" not in settings.DATABASE_URL.lower():
        return
    stmts = [
        """CREATE TABLE IF NOT EXISTS pm_project (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
            project_number VARCHAR(20) NOT NULL,
            name VARCHAR(255) NOT NULL,
            description TEXT,
            status VARCHAR(30) NOT NULL DEFAULT 'planning',
            priority VARCHAR(20) NOT NULL DEFAULT 'medium',
            customer_id UUID REFERENCES customer(id) ON DELETE SET NULL,
            customer_name VARCHAR(255),
            owner_id UUID REFERENCES "user"(id) ON DELETE SET NULL,
            owner_name VARCHAR(255),
            start_date DATE,
            end_date DATE,
            due_date DATE,
            budget NUMERIC(14,2),
            currency VARCHAR(3) NOT NULL DEFAULT 'INR',
            progress_percent INTEGER NOT NULL DEFAULT 0,
            color VARCHAR(7),
            tags JSONB DEFAULT '[]'::jsonb,
            milestones JSONB DEFAULT '[]'::jsonb,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now(),
            completed_at TIMESTAMPTZ
        );""",
        "CREATE INDEX IF NOT EXISTS ix_pm_project_vendor_id ON pm_project(vendor_id);",
        "CREATE INDEX IF NOT EXISTS ix_pm_project_vendor_status ON pm_project(vendor_id, status);",
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_pm_project_vendor_number ON pm_project(vendor_id, project_number);",
        "CREATE INDEX IF NOT EXISTS ix_pm_project_customer_id ON pm_project(customer_id);",
        "CREATE INDEX IF NOT EXISTS ix_pm_project_owner_id ON pm_project(owner_id);",
        """CREATE TABLE IF NOT EXISTS pm_task (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
            project_id UUID NOT NULL REFERENCES pm_project(id) ON DELETE CASCADE,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            status VARCHAR(30) NOT NULL DEFAULT 'todo',
            priority VARCHAR(20) NOT NULL DEFAULT 'medium',
            assignee_id UUID REFERENCES "user"(id) ON DELETE SET NULL,
            assignee_name VARCHAR(255),
            due_date DATE,
            position INTEGER NOT NULL DEFAULT 0,
            labels JSONB DEFAULT '[]'::jsonb,
            checklist JSONB DEFAULT '[]'::jsonb,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now(),
            completed_at TIMESTAMPTZ
        );""",
        "CREATE INDEX IF NOT EXISTS ix_pm_task_vendor_id ON pm_task(vendor_id);",
        "CREATE INDEX IF NOT EXISTS ix_pm_task_project_id ON pm_task(project_id);",
        "CREATE INDEX IF NOT EXISTS ix_pm_task_project_status ON pm_task(project_id, status);",
        "CREATE INDEX IF NOT EXISTS ix_pm_task_project_position ON pm_task(project_id, status, position);",
        "ALTER TABLE pm_task ADD COLUMN IF NOT EXISTS parent_task_id UUID REFERENCES pm_task(id) ON DELETE SET NULL;",
        "ALTER TABLE pm_task ADD COLUMN IF NOT EXISTS linked_task_ids JSONB DEFAULT '[]'::jsonb;",
        "CREATE INDEX IF NOT EXISTS ix_pm_task_parent_task_id ON pm_task(parent_task_id);",
    ]
    async with engine.begin() as conn:
        for s in stmts:
            await conn.execute(text(s))


async def ensure_txn_store_id_columns() -> None:
    """
    Add store_id to order, pos_transaction, invoice, booking (Alembic ms003_txn_store_id).

    Idempotent when that migration was not applied to the database in use.
    Columns are committed first; FK/index/backfill run in a follow-up transaction.
    """
    if "postgresql" not in settings.DATABASE_URL.lower():
        return

    column_stmts = [
        'ALTER TABLE "order" ADD COLUMN IF NOT EXISTS store_id UUID',
        "ALTER TABLE pos_transaction ADD COLUMN IF NOT EXISTS store_id UUID",
        "ALTER TABLE invoice ADD COLUMN IF NOT EXISTS store_id UUID",
        "ALTER TABLE booking ADD COLUMN IF NOT EXISTS store_id UUID",
    ]
    fk_specs = (
        ("fk_order_store", '"order"', "store_id"),
        ("fk_pos_txn_store", "pos_transaction", "store_id"),
        ("fk_invoice_store", "invoice", "store_id"),
        ("fk_booking_store", "booking", "store_id"),
    )
    index_stmts = [
        'CREATE INDEX IF NOT EXISTS ix_order_vendor_store ON "order" (vendor_id, store_id)',
        "CREATE INDEX IF NOT EXISTS ix_pos_txn_vendor_store ON pos_transaction (vendor_id, store_id)",
        "CREATE INDEX IF NOT EXISTS ix_invoice_vendor_store ON invoice (vendor_id, store_id)",
        "CREATE INDEX IF NOT EXISTS ix_booking_vendor_store ON booking (vendor_id, store_id)",
    ]
    backfill = """
    UPDATE {table} AS t
    SET store_id = sub.store_id
    FROM (
        SELECT DISTINCT ON (s.vendor_id) s.vendor_id, s.id AS store_id
        FROM store s
        WHERE s.is_active = true
        ORDER BY s.vendor_id, s.is_default DESC, s.created_at ASC
    ) AS sub
    WHERE t.vendor_id = sub.vendor_id AND t.store_id IS NULL;
    """

    async with engine.begin() as conn:
        for stmt in column_stmts:
            await conn.execute(text(stmt))

    try:
        async with engine.begin() as conn:
            store_ok = await conn.scalar(
                text(
                    "SELECT EXISTS ("
                    "SELECT 1 FROM information_schema.tables "
                    "WHERE table_schema = 'public' AND table_name = 'store'"
                    ")"
                )
            )
            if not store_ok:
                logger.warning(
                    "ensure_txn_store_id_columns: store table missing; "
                    "store_id columns added, skipping FK/backfill"
                )
                return
            for fk_name, table, column in fk_specs:
                await conn.execute(
                    text(
                        f"""
                        DO $$
                        BEGIN
                            IF NOT EXISTS (
                                SELECT 1 FROM pg_constraint WHERE conname = '{fk_name}'
                            ) THEN
                                ALTER TABLE {table}
                                ADD CONSTRAINT {fk_name}
                                FOREIGN KEY ({column}) REFERENCES store(id) ON DELETE SET NULL;
                            END IF;
                        END $$;
                        """
                    )
                )
            for stmt in index_stmts:
                await conn.execute(text(stmt))
            for table in ('"order"', "pos_transaction", "invoice", "booking"):
                await conn.execute(text(backfill.format(table=table)))
    except Exception:
        logger.exception(
            "ensure_txn_store_id_columns: FK/index/backfill failed; store_id columns remain"
        )
        return

    logger.info("ensure_txn_store_id_columns: order/pos/invoice/booking store_id ready")


async def ensure_store_hierarchy_columns() -> None:
    """
    Add store.parent_id + store.unit_type (Alembic ms006_store_hierarchy).

    parent_id=NULL means the row is a Business Unit; parent_id set means it's
    a Branch under that BU. Idempotent when that migration was not applied to
    the database in use.
    """
    if "postgresql" not in settings.DATABASE_URL.lower():
        return

    async with engine.begin() as conn:
        await conn.execute(text("ALTER TABLE store ADD COLUMN IF NOT EXISTS parent_id UUID"))
        await conn.execute(
            text(
                "ALTER TABLE store ADD COLUMN IF NOT EXISTS unit_type VARCHAR(20) "
                "NOT NULL DEFAULT 'business_unit'"
            )
        )

    try:
        async with engine.begin() as conn:
            await conn.execute(
                text(
                    """
                    DO $$
                    BEGIN
                        IF NOT EXISTS (
                            SELECT 1 FROM pg_constraint WHERE conname = 'fk_store_parent'
                        ) THEN
                            ALTER TABLE store
                            ADD CONSTRAINT fk_store_parent
                            FOREIGN KEY (parent_id) REFERENCES store(id) ON DELETE RESTRICT;
                        END IF;
                    END $$;
                    """
                )
            )
            await conn.execute(
                text("CREATE INDEX IF NOT EXISTS idx_store_parent ON store (vendor_id, parent_id)")
            )
            await conn.execute(text("UPDATE store SET unit_type = 'business_unit' WHERE unit_type IS NULL"))
    except Exception:
        logger.exception(
            "ensure_store_hierarchy_columns: FK/index/backfill failed; columns remain"
        )
        return

    logger.info("ensure_store_hierarchy_columns: store.parent_id/unit_type ready")


async def ensure_sales_area_tables() -> None:
    """
    Sales & Distribution (SD) org data (Alembic ms007_sales_area):
      sales_division, distribution_channel, delivery_channel, sales_area
      + nullable sales_area_id/delivery_channel_id/division_id link columns on
      order/pos_transaction/booking/invoice/product.

    Sales Organization is not a new table — it reuses Store rows with
    parent_id IS NULL (Business Units). Idempotent when that migration was not
    applied to the database in use.
    """
    if "postgresql" not in settings.DATABASE_URL.lower():
        return

    table_stmts = [
        """CREATE TABLE IF NOT EXISTS sales_division (
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
        );""",
        "CREATE INDEX IF NOT EXISTS ix_sales_division_vendor ON sales_division (vendor_id, is_active);",
        """CREATE TABLE IF NOT EXISTS distribution_channel (
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
        );""",
        "CREATE INDEX IF NOT EXISTS ix_distribution_channel_vendor ON distribution_channel (vendor_id, is_active);",
        """CREATE TABLE IF NOT EXISTS delivery_channel (
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
        );""",
        "CREATE INDEX IF NOT EXISTS ix_delivery_channel_vendor ON delivery_channel (vendor_id, is_active);",
        """CREATE TABLE IF NOT EXISTS sales_area (
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
        );""",
        "CREATE INDEX IF NOT EXISTS ix_sales_area_vendor ON sales_area (vendor_id, is_active);",
        "CREATE INDEX IF NOT EXISTS ix_sales_area_bu ON sales_area (business_unit_id);",
    ]

    link_column_stmts = [
        'ALTER TABLE "order" ADD COLUMN IF NOT EXISTS sales_area_id UUID',
        'ALTER TABLE "order" ADD COLUMN IF NOT EXISTS delivery_channel_id UUID',
        "ALTER TABLE pos_transaction ADD COLUMN IF NOT EXISTS sales_area_id UUID",
        "ALTER TABLE pos_transaction ADD COLUMN IF NOT EXISTS delivery_channel_id UUID",
        "ALTER TABLE booking ADD COLUMN IF NOT EXISTS sales_area_id UUID",
        "ALTER TABLE booking ADD COLUMN IF NOT EXISTS delivery_channel_id UUID",
        "ALTER TABLE invoice ADD COLUMN IF NOT EXISTS sales_area_id UUID",
        "ALTER TABLE product ADD COLUMN IF NOT EXISTS division_id UUID",
        "ALTER TABLE pm_project ADD COLUMN IF NOT EXISTS sales_area_id UUID",
    ]
    fk_specs = (
        ("fk_order_sales_area", '"order"', "sales_area_id", "sales_area", "SET NULL"),
        ("fk_order_delivery_channel", '"order"', "delivery_channel_id", "delivery_channel", "SET NULL"),
        ("fk_pos_txn_sales_area", "pos_transaction", "sales_area_id", "sales_area", "SET NULL"),
        ("fk_pos_txn_delivery_channel", "pos_transaction", "delivery_channel_id", "delivery_channel", "SET NULL"),
        ("fk_booking_sales_area", "booking", "sales_area_id", "sales_area", "SET NULL"),
        ("fk_booking_delivery_channel", "booking", "delivery_channel_id", "delivery_channel", "SET NULL"),
        ("fk_invoice_sales_area", "invoice", "sales_area_id", "sales_area", "SET NULL"),
        ("fk_product_division", "product", "division_id", "sales_division", "SET NULL"),
        ("fk_pm_project_sales_area", "pm_project", "sales_area_id", "sales_area", "SET NULL"),
    )
    link_index_stmts = [
        'CREATE INDEX IF NOT EXISTS ix_order_sales_area ON "order" (vendor_id, sales_area_id)',
        "CREATE INDEX IF NOT EXISTS ix_pos_txn_sales_area ON pos_transaction (vendor_id, sales_area_id)",
        "CREATE INDEX IF NOT EXISTS ix_booking_sales_area ON booking (vendor_id, sales_area_id)",
        "CREATE INDEX IF NOT EXISTS ix_invoice_sales_area ON invoice (vendor_id, sales_area_id)",
        "CREATE INDEX IF NOT EXISTS idx_product_division ON product (vendor_id, division_id)",
        "CREATE INDEX IF NOT EXISTS ix_pm_project_sales_area ON pm_project (vendor_id, sales_area_id)",
    ]

    async with engine.begin() as conn:
        for stmt in table_stmts:
            await conn.execute(text(stmt))
        for stmt in link_column_stmts:
            await conn.execute(text(stmt))

    try:
        async with engine.begin() as conn:
            for fk_name, table, column, ref_table, on_delete in fk_specs:
                await conn.execute(
                    text(
                        f"""
                        DO $$
                        BEGIN
                            IF NOT EXISTS (
                                SELECT 1 FROM pg_constraint WHERE conname = '{fk_name}'
                            ) THEN
                                ALTER TABLE {table}
                                ADD CONSTRAINT {fk_name}
                                FOREIGN KEY ({column}) REFERENCES {ref_table}(id) ON DELETE {on_delete};
                            END IF;
                        END $$;
                        """
                    )
                )
            for stmt in link_index_stmts:
                await conn.execute(text(stmt))
    except Exception:
        logger.exception(
            "ensure_sales_area_tables: FK/index setup failed; tables/columns remain"
        )
        return

    logger.info("ensure_sales_area_tables: sales_division/distribution_channel/delivery_channel/sales_area ready")


async def ensure_controlling_area_tables() -> None:
    """
    Controlling Area (Alembic ms010_controlling_area): co_controlling_area
    table + nullable fin_company.controlling_area_id link column.

    A vendor's companies are lazily rolled into a "Standard" controlling area
    on first access to the Controlling Areas screen (see
    app/api/v1/vendor_controlling_area.py); this function only ensures the
    schema exists. Idempotent when that migration was not applied to the
    database in use.
    """
    if "postgresql" not in settings.DATABASE_URL.lower():
        return

    async with engine.begin() as conn:
        await conn.execute(text(
            """CREATE TABLE IF NOT EXISTS co_controlling_area (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
                code VARCHAR(20) NOT NULL,
                name VARCHAR(200) NOT NULL,
                description TEXT,
                currency VARCHAR(3) DEFAULT 'INR',
                is_active BOOLEAN DEFAULT TRUE,
                is_default BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMPTZ DEFAULT now(),
                updated_at TIMESTAMPTZ DEFAULT now(),
                CONSTRAINT uq_co_controlling_area_vendor_code UNIQUE (vendor_id, code)
            );"""
        ))
        await conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_co_controlling_area_vendor ON co_controlling_area (vendor_id, is_active)"
        ))
        await conn.execute(text(
            "ALTER TABLE fin_company ADD COLUMN IF NOT EXISTS controlling_area_id UUID"
        ))

    try:
        async with engine.begin() as conn:
            await conn.execute(text(
                """
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint WHERE conname = 'fk_fin_company_controlling_area'
                    ) THEN
                        ALTER TABLE fin_company
                        ADD CONSTRAINT fk_fin_company_controlling_area
                        FOREIGN KEY (controlling_area_id) REFERENCES co_controlling_area(id) ON DELETE SET NULL;
                    END IF;
                END $$;
                """
            ))
            await conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_fin_company_controlling_area ON fin_company (controlling_area_id)"
            ))
    except Exception:
        logger.exception(
            "ensure_controlling_area_tables: FK/index setup failed; table/column remain"
        )
        return

    logger.info("ensure_controlling_area_tables: co_controlling_area/fin_company.controlling_area_id ready")


async def ensure_production_materials_columns() -> None:
    """
    Production materials integration (Alembic ms008_production_materials):
      stock_reservation.store_id / storage_location_id / consumed_at
      production_order.material_requirements / materials_reserved_at /
        materials_released_at / inventory_posted_at / planned & actual
        material+labor cost columns.

    Idempotent when that migration was not applied to the database in use.
    """
    if "postgresql" not in settings.DATABASE_URL.lower():
        return

    column_stmts = [
        "ALTER TABLE stock_reservation ADD COLUMN IF NOT EXISTS store_id UUID",
        "ALTER TABLE stock_reservation ADD COLUMN IF NOT EXISTS storage_location_id UUID",
        "ALTER TABLE stock_reservation ADD COLUMN IF NOT EXISTS consumed_at TIMESTAMPTZ",
        "ALTER TABLE production_order ADD COLUMN IF NOT EXISTS material_requirements JSONB NOT NULL DEFAULT '[]'::jsonb",
        "ALTER TABLE production_order ADD COLUMN IF NOT EXISTS materials_reserved_at TIMESTAMPTZ",
        "ALTER TABLE production_order ADD COLUMN IF NOT EXISTS materials_released_at TIMESTAMPTZ",
        "ALTER TABLE production_order ADD COLUMN IF NOT EXISTS inventory_posted_at TIMESTAMPTZ",
        "ALTER TABLE production_order ADD COLUMN IF NOT EXISTS planned_material_cost NUMERIC(14,2)",
        "ALTER TABLE production_order ADD COLUMN IF NOT EXISTS planned_labor_cost NUMERIC(14,2)",
        "ALTER TABLE production_order ADD COLUMN IF NOT EXISTS actual_material_cost NUMERIC(14,2)",
        "ALTER TABLE production_order ADD COLUMN IF NOT EXISTS actual_labor_cost NUMERIC(14,2)",
    ]

    async with engine.begin() as conn:
        for stmt in column_stmts:
            await conn.execute(text(stmt))

    fk_specs = (
        ("fk_stock_reservation_store", "stock_reservation", "store_id", "store", "SET NULL"),
        ("fk_stock_reservation_location", "stock_reservation", "storage_location_id", "storage_location", "SET NULL"),
    )
    try:
        async with engine.begin() as conn:
            for fk_name, table, column, ref_table, on_delete in fk_specs:
                await conn.execute(
                    text(
                        f"""
                        DO $$
                        BEGIN
                            IF NOT EXISTS (
                                SELECT 1 FROM pg_constraint WHERE conname = '{fk_name}'
                            ) THEN
                                ALTER TABLE {table}
                                ADD CONSTRAINT {fk_name}
                                FOREIGN KEY ({column}) REFERENCES {ref_table}(id) ON DELETE {on_delete};
                            END IF;
                        END $$;
                        """
                    )
                )
            await conn.execute(
                text("CREATE INDEX IF NOT EXISTS idx_resv_store ON stock_reservation (vendor_id, store_id)")
            )
    except Exception:
        logger.exception(
            "ensure_production_materials_columns: FK/index setup failed; columns remain"
        )
        return

    logger.info("ensure_production_materials_columns: stock_reservation/production_order materials columns ready")


async def ensure_production_routing_tables() -> None:
    """
    Production routing (Alembic ms009_production_routing):
      work_center           — machine/workstation/crew + per-hour cost rate.
      production_operation  — ordered routing steps per production_order.

    Idempotent when that migration was not applied to the database in use.
    """
    if "postgresql" not in settings.DATABASE_URL.lower():
        return

    table_stmts = [
        """CREATE TABLE IF NOT EXISTS work_center (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
            plant_id UUID REFERENCES plant(id) ON DELETE SET NULL,
            code VARCHAR(50) NOT NULL,
            name VARCHAR(200) NOT NULL,
            description TEXT,
            capacity_per_day NUMERIC(10,2),
            cost_per_hour NUMERIC(12,2) NOT NULL DEFAULT 0,
            is_active BOOLEAN DEFAULT TRUE,
            sort_order INTEGER DEFAULT 0,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now(),
            CONSTRAINT uq_work_center_vendor_code UNIQUE (vendor_id, code)
        );""",
        "CREATE INDEX IF NOT EXISTS idx_work_center_vendor ON work_center (vendor_id);",
        "CREATE INDEX IF NOT EXISTS idx_work_center_plant ON work_center (vendor_id, plant_id);",
        """CREATE TABLE IF NOT EXISTS production_operation (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
            production_order_id UUID NOT NULL REFERENCES production_order(id) ON DELETE CASCADE,
            work_center_id UUID REFERENCES work_center(id) ON DELETE SET NULL,
            sequence INTEGER NOT NULL DEFAULT 0,
            name VARCHAR(200) NOT NULL DEFAULT 'Operation',
            status VARCHAR(20) NOT NULL DEFAULT 'pending',
            planned_hours NUMERIC(10,2) DEFAULT 0,
            actual_hours NUMERIC(10,2),
            planned_start TIMESTAMPTZ,
            planned_end TIMESTAMPTZ,
            started_at TIMESTAMPTZ,
            completed_at TIMESTAMPTZ,
            notes TEXT,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now()
        );""",
        "CREATE INDEX IF NOT EXISTS idx_prod_op_order_seq ON production_operation (production_order_id, sequence);",
        "CREATE INDEX IF NOT EXISTS idx_prod_op_vendor ON production_operation (vendor_id);",
        "CREATE INDEX IF NOT EXISTS idx_prod_op_work_center ON production_operation (work_center_id);",
    ]

    async with engine.begin() as conn:
        for stmt in table_stmts:
            await conn.execute(text(stmt))

    logger.info("ensure_production_routing_tables: work_center/production_operation ready")


async def ensure_user_contact_change_request_table() -> None:
    """Contact change approval requests (email/phone) for verified vendor users."""
    if "postgresql" not in settings.DATABASE_URL.lower():
        return
    stmts = [
        """
        CREATE TABLE IF NOT EXISTS user_contact_change_request (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
            vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
            field_type VARCHAR(20) NOT NULL,
            current_value VARCHAR(255) NOT NULL,
            requested_value VARCHAR(255) NOT NULL,
            reason TEXT,
            status VARCHAR(20) NOT NULL DEFAULT 'pending',
            reviewed_by_user_id UUID REFERENCES "user"(id) ON DELETE SET NULL,
            review_notes TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            resolved_at TIMESTAMPTZ
        )
        """,
        "CREATE INDEX IF NOT EXISTS ix_user_contact_change_request_user ON user_contact_change_request(user_id)",
        "CREATE INDEX IF NOT EXISTS ix_user_contact_change_request_vendor ON user_contact_change_request(vendor_id)",
        "CREATE INDEX IF NOT EXISTS ix_user_contact_change_request_status ON user_contact_change_request(status)",
    ]
    async with engine.begin() as conn:
        for s in stmts:
            await conn.execute(text(s))
