"""Apply fiscal year schema (fin004–fin006) for databases on the commission path.

When this revision runs, the DB has not applied fin003–fin006; `fin_fiscal_year` may exist
from fin001 and lack `variant_code`, causing SQLAlchemy to fail.

This migration mirrors the essential steps from fin004, fin005, and fin006 with guards.

Revision ID: comm005_finance_fiscal_catchup
Revises: comm004_payee_bank_details
"""
from alembic import op
from sqlalchemy import text

revision = "comm005_finance_fiscal_catchup"
down_revision = "comm004_payee_bank_details"
branch_labels = None
depends_on = None


def _has_column(conn, table: str, col: str) -> bool:
    r = conn.execute(
        text(
            """
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = :t AND column_name = :c
            """
        ),
        {"t": table, "c": col},
    )
    return r.scalar() is not None


def _table_exists(conn, table: str) -> bool:
    r = conn.execute(
        text(
            """
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = :t
            """
        ),
        {"t": table},
    )
    return r.scalar() is not None


def upgrade() -> None:
    conn = op.get_bind()
    if not _table_exists(conn, "fin_fiscal_year"):
        return
    if (
        _table_exists(conn, "fin_fiscal_year_company")
        and not _has_column(conn, "fin_fiscal_year", "company_id")
        and _has_column(conn, "fin_fiscal_year", "variant_code")
    ):
        return

    # fin004: period_kind
    if _table_exists(conn, "fin_period") and not _has_column(conn, "fin_period", "period_kind"):
        op.execute(
            """
            ALTER TABLE fin_period ADD COLUMN period_kind VARCHAR(20) NOT NULL DEFAULT 'standard'
        """
        )
        op.execute("ALTER TABLE fin_period DROP CONSTRAINT IF EXISTS ck_fin_period_kind")
        op.execute(
            """
            ALTER TABLE fin_period ADD CONSTRAINT ck_fin_period_kind
            CHECK (period_kind IN ('standard', 'audit'))
        """
        )

    # --- fin005 (idempotent) ---
    if not _has_column(conn, "fin_fiscal_year", "company_id"):
        op.execute(
            """
            ALTER TABLE fin_fiscal_year ADD COLUMN company_id
            UUID REFERENCES fin_company(id) ON DELETE RESTRICT
        """
        )
    if not _has_column(conn, "fin_fiscal_year", "variant_code"):
        op.execute("ALTER TABLE fin_fiscal_year ADD COLUMN variant_code VARCHAR(40)")

    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_fin_fiscal_year_vendor_company
        ON fin_fiscal_year(vendor_id, company_id)
    """
    )

    op.execute(
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
    op.execute(
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
    op.execute(
        """
        INSERT INTO fin_company (vendor_id, code, name, is_default, is_active, currency, country, address)
        SELECT v.id, '1000', v.business_name, TRUE, TRUE, 'INR', 'IN', '{}'::jsonb
        FROM vendor v
        WHERE v.id IN (SELECT vendor_id FROM fin_fiscal_year WHERE company_id IS NULL)
        AND v.id NOT IN (SELECT vendor_id FROM fin_company)
        ON CONFLICT (vendor_id, code) DO NOTHING
    """
    )
    op.execute(
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
    op.execute(
        """
        UPDATE fin_fiscal_year
        SET variant_code = 'V' || REPLACE(CAST(id AS TEXT), '-', '')
        WHERE variant_code IS NULL
    """
    )
    op.execute("ALTER TABLE fin_fiscal_year ALTER COLUMN variant_code SET NOT NULL")
    n = conn.execute(text("SELECT count(*) FROM fin_fiscal_year WHERE company_id IS NULL")).scalar()
    if n and int(n) > 0:
        raise RuntimeError(
            f"comm005_finance_fiscal_catchup: {n} fin_fiscal_year row(s) still have null company_id; "
            "add fin_company rows for those vendors and retry."
        )
    op.execute("ALTER TABLE fin_fiscal_year ALTER COLUMN company_id SET NOT NULL")
    op.execute("ALTER TABLE fin_fiscal_year DROP CONSTRAINT IF EXISTS uq_fin_fy_vendor_company_variant")
    op.execute(
        """
        ALTER TABLE fin_fiscal_year ADD CONSTRAINT uq_fin_fy_vendor_company_variant
        UNIQUE (vendor_id, company_id, variant_code)
    """
    )

    # --- fin006 ---
    op.execute(
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
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_fin_fy_co_vendor_company "
        "ON fin_fiscal_year_company(vendor_id, company_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_fin_fy_co_fiscal_year "
        "ON fin_fiscal_year_company(fiscal_year_id)"
    )
    op.execute(
        """
        INSERT INTO fin_fiscal_year_company (id, vendor_id, fiscal_year_id, company_id, is_current)
        SELECT gen_random_uuid(), f.vendor_id, f.id, f.company_id, COALESCE(f.is_current, false)
        FROM fin_fiscal_year f
        WHERE NOT EXISTS (
            SELECT 1 FROM fin_fiscal_year_company c WHERE c.fiscal_year_id = f.id
        )
    """
    )
    op.execute("ALTER TABLE fin_fiscal_year DROP CONSTRAINT IF EXISTS uq_fin_fy_vendor_company_variant")
    op.execute(
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
    op.execute("ALTER TABLE fin_fiscal_year DROP CONSTRAINT IF EXISTS fin_fiscal_year_company_id_fkey")
    op.execute("DROP INDEX IF EXISTS ix_fin_fiscal_year_vendor_company")
    op.execute("ALTER TABLE fin_fiscal_year DROP COLUMN IF EXISTS company_id")
    op.execute("ALTER TABLE fin_fiscal_year DROP COLUMN IF EXISTS is_current")
    op.execute(
        """
        ALTER TABLE fin_fiscal_year ADD CONSTRAINT uq_fin_fy_vendor_variant
        UNIQUE (vendor_id, variant_code)
    """
    )


def downgrade() -> None:
    pass
