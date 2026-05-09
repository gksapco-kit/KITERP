"""Fiscal year scoped by company + variant code.

Revision ID: fin005_fiscal_year_company
Revises: fin004_fiscal_period_kind
"""
from alembic import op
from sqlalchemy import text

revision = "fin005_fiscal_year_company"
down_revision = "fin004_fiscal_period_kind"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE fin_fiscal_year ADD COLUMN IF NOT EXISTS company_id "
        "UUID REFERENCES fin_company(id) ON DELETE RESTRICT"
    )
    op.execute("ALTER TABLE fin_fiscal_year ADD COLUMN IF NOT EXISTS variant_code VARCHAR(40)")
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_fin_fiscal_year_vendor_company "
        "ON fin_fiscal_year(vendor_id, company_id)"
    )
    # Backfill company from default fin_company per vendor
    op.execute("""
        UPDATE fin_fiscal_year fy
        SET company_id = (
            SELECT c.id FROM fin_company c
            WHERE c.vendor_id = fy.vendor_id AND c.is_default = TRUE
            LIMIT 1
        )
        WHERE company_id IS NULL
    """)
    op.execute("""
        UPDATE fin_fiscal_year fy
        SET company_id = (
            SELECT c.id FROM fin_company c
            WHERE c.vendor_id = fy.vendor_id
            ORDER BY c.code
            LIMIT 1
        )
        WHERE company_id IS NULL
    """)
    # Ensure a fin_company row exists for any vendor that still has orphan fiscal years
    op.execute("""
        INSERT INTO fin_company (vendor_id, code, name, is_default, is_active, currency, country, address)
        SELECT v.id, '1000', v.business_name, TRUE, TRUE, 'INR', 'IN', '{}'::jsonb
        FROM vendor v
        WHERE v.id IN (SELECT vendor_id FROM fin_fiscal_year WHERE company_id IS NULL)
        AND v.id NOT IN (SELECT vendor_id FROM fin_company)
        ON CONFLICT (vendor_id, code) DO NOTHING
    """)
    op.execute("""
        UPDATE fin_fiscal_year fy
        SET company_id = (
            SELECT c.id FROM fin_company c
            WHERE c.vendor_id = fy.vendor_id
            ORDER BY c.is_default DESC, c.code
            LIMIT 1
        )
        WHERE company_id IS NULL
    """)
    # One code per (vendor, company) — use stable unique from row id (legacy rows)
    op.execute("""
        UPDATE fin_fiscal_year
        SET variant_code = 'V' || REPLACE(CAST(id AS TEXT), '-', '')
        WHERE variant_code IS NULL
    """)
    op.execute("ALTER TABLE fin_fiscal_year ALTER COLUMN variant_code SET NOT NULL")
    conn = op.get_bind()
    n = conn.execute(text("SELECT count(*) FROM fin_fiscal_year WHERE company_id IS NULL")).scalar()
    if n and int(n) > 0:
        raise RuntimeError(
            f"fin005_fiscal_year_company: {n} fin_fiscal_year row(s) still have null company_id; "
            "add fin_company rows for those vendors and retry."
        )
    op.execute("ALTER TABLE fin_fiscal_year ALTER COLUMN company_id SET NOT NULL")
    op.execute(
        "ALTER TABLE fin_fiscal_year ADD CONSTRAINT uq_fin_fy_vendor_company_variant "
        "UNIQUE (vendor_id, company_id, variant_code)"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE fin_fiscal_year DROP CONSTRAINT IF EXISTS uq_fin_fy_vendor_company_variant")
    op.execute("ALTER TABLE fin_fiscal_year ALTER COLUMN company_id DROP NOT NULL")
    op.execute("ALTER TABLE fin_fiscal_year ALTER COLUMN variant_code DROP NOT NULL")
    op.execute("ALTER TABLE fin_fiscal_year DROP COLUMN IF EXISTS variant_code")
    op.execute("DROP INDEX IF EXISTS ix_fin_fiscal_year_vendor_company")
    op.execute("ALTER TABLE fin_fiscal_year DROP COLUMN IF EXISTS company_id")
