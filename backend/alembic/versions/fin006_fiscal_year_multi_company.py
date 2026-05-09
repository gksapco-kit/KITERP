"""Fiscal year calendar shared across company codes (junction table).

Revision ID: fin006_fiscal_year_multi_company
Revises: fin005_fiscal_year_company
"""
from alembic import op
from sqlalchemy import text

revision = "fin006_fiscal_year_multi_company"
down_revision = "fin005_fiscal_year_company"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS fin_fiscal_year_company (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
            fiscal_year_id UUID NOT NULL REFERENCES fin_fiscal_year(id) ON DELETE CASCADE,
            company_id UUID NOT NULL REFERENCES fin_company(id) ON DELETE RESTRICT,
            is_current BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            CONSTRAINT uq_fin_fy_co_fy_company UNIQUE (fiscal_year_id, company_id)
        )
    """)
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_fin_fy_co_vendor_company "
        "ON fin_fiscal_year_company(vendor_id, company_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_fin_fy_co_fiscal_year "
        "ON fin_fiscal_year_company(fiscal_year_id)"
    )

    # One assignment row per existing fiscal year row (idempotent if re-run).
    # Older / partially migrated DBs might not have fin_fiscal_year.is_current anymore.
    # Use dynamic SQL to avoid referencing a missing column.
    op.execute("""
    DO $$
    DECLARE
        has_is_current boolean;
        stmt text;
    BEGIN
        SELECT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = current_schema()
              AND table_name = 'fin_fiscal_year'
              AND column_name = 'is_current'
        ) INTO has_is_current;

        stmt :=
            'INSERT INTO fin_fiscal_year_company (id, vendor_id, fiscal_year_id, company_id, is_current) ' ||
            'SELECT gen_random_uuid(), f.vendor_id, f.id, f.company_id, ' ||
            CASE WHEN has_is_current THEN 'COALESCE(f.is_current, false)' ELSE 'false' END ||
            ' FROM fin_fiscal_year f ' ||
            'WHERE NOT EXISTS (SELECT 1 FROM fin_fiscal_year_company c WHERE c.fiscal_year_id = f.id)';

        EXECUTE stmt;
    END $$;
    """)

    op.execute("ALTER TABLE fin_fiscal_year DROP CONSTRAINT IF EXISTS uq_fin_fy_vendor_company_variant")

    # After dropping company, (vendor, variant) must be unique — disambiguate duplicates
    op.execute("""
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
    """)

    op.execute("ALTER TABLE fin_fiscal_year DROP CONSTRAINT IF EXISTS fin_fiscal_year_company_id_fkey")
    op.execute("DROP INDEX IF EXISTS ix_fin_fiscal_year_vendor_company")
    op.execute("ALTER TABLE fin_fiscal_year DROP COLUMN IF EXISTS company_id")
    op.execute("ALTER TABLE fin_fiscal_year DROP COLUMN IF EXISTS is_current")
    # Postgres doesn't support IF NOT EXISTS for ADD CONSTRAINT.
    op.execute("""
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conname = 'uq_fin_fy_vendor_variant'
        ) THEN
            ALTER TABLE fin_fiscal_year
            ADD CONSTRAINT uq_fin_fy_vendor_variant
            UNIQUE (vendor_id, variant_code);
        END IF;
    END $$;
    """)


def downgrade() -> None:
    conn = op.get_bind()
    # Restore columns (best-effort; pre-fin006 data shape)
    op.execute("ALTER TABLE fin_fiscal_year DROP CONSTRAINT IF EXISTS uq_fin_fy_vendor_variant")
    op.execute("ALTER TABLE fin_fiscal_year ADD COLUMN IF NOT EXISTS company_id UUID")
    op.execute("ALTER TABLE fin_fiscal_year ADD COLUMN IF NOT EXISTS is_current BOOLEAN DEFAULT FALSE")
    # Pick first company per FY from junction
    op.execute("""
        UPDATE fin_fiscal_year f
        SET company_id = x.company_id, is_current = x.is_current
        FROM (
            SELECT DISTINCT ON (fiscal_year_id) fiscal_year_id, company_id, is_current
            FROM fin_fiscal_year_company
            ORDER BY fiscal_year_id, is_current DESC, company_id
        ) x
        WHERE f.id = x.fiscal_year_id
    """)
    n = conn.execute(
        text("SELECT count(*) FROM fin_fiscal_year WHERE company_id IS NULL")
    ).scalar()
    if n and int(n) > 0:
        op.execute("""
            UPDATE fin_fiscal_year f
            SET company_id = (
                SELECT c.id FROM fin_company c
                WHERE c.vendor_id = f.vendor_id
                ORDER BY c.is_default DESC, c.code LIMIT 1
            )
            WHERE company_id IS NULL
        """)
    op.execute(
        "ALTER TABLE fin_fiscal_year ADD CONSTRAINT fin_fiscal_year_company_id_fkey "
        "FOREIGN KEY (company_id) REFERENCES fin_company(id) ON DELETE RESTRICT"
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_fin_fiscal_year_vendor_company ON fin_fiscal_year(vendor_id, company_id)")
    op.execute(
        "ALTER TABLE fin_fiscal_year ADD CONSTRAINT uq_fin_fy_vendor_company_variant "
        "UNIQUE (vendor_id, company_id, variant_code)"
    )
    op.execute("DROP TABLE IF EXISTS fin_fiscal_year_company")
