"""Enterprise Journal Entry: multi-company, dimensions, approval gating.

Adds:
  - fin_company           (multi-entity ledger)
  - fin_cost_center       (cost/profit centre)
  - fin_project           (project/WBS)
  - fin_intercompany_partner (IC relationships)

Extends fin_journal_entry:
  - company_id, document_date, document_type, header_text, requires_approval,
    approval_request_id; status gains 'pending_approval'

Extends fin_journal_line:
  - cost_center_id, project_id, intercompany_partner_id, value_date,
    ref_doc_type, ref_doc_id, ref_doc_no, tax_code, tax_amount, assignment

Revision ID: fin002_je_enterprise
Revises: fin001_add_finance_tables
Create Date: 2026-04-20
"""
from alembic import op

revision = "fin002_je_enterprise"
down_revision = "fin001_add_finance_tables"
branch_labels = None
depends_on = None


def x(sql: str) -> None:
    op.execute(sql.strip())


def upgrade() -> None:
    # ── 1. fin_company ────────────────────────────────────────────────────────
    x("""
    CREATE TABLE IF NOT EXISTS fin_company (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
        code VARCHAR(20) NOT NULL,
        name VARCHAR(200) NOT NULL,
        currency VARCHAR(3) NOT NULL DEFAULT 'INR',
        country VARCHAR(3) NOT NULL DEFAULT 'IN',
        tax_id VARCHAR(50),
        address JSONB NOT NULL DEFAULT '{}',
        is_default BOOLEAN NOT NULL DEFAULT FALSE,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT uq_fin_company_vendor_code UNIQUE (vendor_id, code)
    )
    """)
    x("CREATE INDEX IF NOT EXISTS ix_fin_company_vendor ON fin_company(vendor_id)")

    # ── 2. fin_cost_center ────────────────────────────────────────────────────
    x("""
    CREATE TABLE IF NOT EXISTS fin_cost_center (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
        company_id UUID NOT NULL REFERENCES fin_company(id) ON DELETE CASCADE,
        code VARCHAR(20) NOT NULL,
        name VARCHAR(200) NOT NULL,
        description TEXT,
        parent_id UUID REFERENCES fin_cost_center(id) ON DELETE SET NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT uq_fin_cc_vendor_company_code UNIQUE (vendor_id, company_id, code)
    )
    """)
    x("CREATE INDEX IF NOT EXISTS ix_fin_cc_vendor ON fin_cost_center(vendor_id)")
    x("CREATE INDEX IF NOT EXISTS ix_fin_cc_company ON fin_cost_center(company_id)")

    # ── 3. fin_project ────────────────────────────────────────────────────────
    x("""
    CREATE TABLE IF NOT EXISTS fin_project (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
        company_id UUID NOT NULL REFERENCES fin_company(id) ON DELETE CASCADE,
        code VARCHAR(30) NOT NULL,
        name VARCHAR(200) NOT NULL,
        description TEXT,
        start_date DATE,
        end_date DATE,
        budget NUMERIC(18,4) NOT NULL DEFAULT 0,
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        manager_id UUID REFERENCES vendor_user(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT uq_fin_project_vendor_company_code UNIQUE (vendor_id, company_id, code)
    )
    """)
    x("CREATE INDEX IF NOT EXISTS ix_fin_project_vendor ON fin_project(vendor_id)")
    x("CREATE INDEX IF NOT EXISTS ix_fin_project_company ON fin_project(company_id)")

    # ── 4. fin_intercompany_partner ───────────────────────────────────────────
    x("""
    CREATE TABLE IF NOT EXISTS fin_intercompany_partner (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
        company_id UUID NOT NULL REFERENCES fin_company(id) ON DELETE CASCADE,
        partner_company_id UUID NOT NULL REFERENCES fin_company(id) ON DELETE CASCADE,
        default_ar_account_id UUID REFERENCES fin_account(id) ON DELETE SET NULL,
        default_ap_account_id UUID REFERENCES fin_account(id) ON DELETE SET NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT uq_fin_ic_company_pair UNIQUE (vendor_id, company_id, partner_company_id)
    )
    """)
    x("CREATE INDEX IF NOT EXISTS ix_fin_ic_vendor ON fin_intercompany_partner(vendor_id)")

    # ── 5. Extend fin_journal_entry ───────────────────────────────────────────
    for col_sql in [
        "ALTER TABLE fin_journal_entry ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES fin_company(id) ON DELETE SET NULL",
        "ALTER TABLE fin_journal_entry ADD COLUMN IF NOT EXISTS document_date DATE",
        "ALTER TABLE fin_journal_entry ADD COLUMN IF NOT EXISTS document_type VARCHAR(10) DEFAULT 'SA'",
        "ALTER TABLE fin_journal_entry ADD COLUMN IF NOT EXISTS header_text TEXT",
        "ALTER TABLE fin_journal_entry ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN NOT NULL DEFAULT FALSE",
        "ALTER TABLE fin_journal_entry ADD COLUMN IF NOT EXISTS approval_request_id UUID REFERENCES fin_approval_request(id) ON DELETE SET NULL",
    ]:
        x(col_sql)
    x("CREATE INDEX IF NOT EXISTS ix_fin_je_company ON fin_journal_entry(company_id)")

    # ── 6. Backfill: create one default company per vendor and link to JEs ────
    x("""
    INSERT INTO fin_company (vendor_id, code, name, is_default, is_active)
    SELECT id, '1000', business_name, TRUE, TRUE
    FROM vendor
    WHERE id NOT IN (SELECT DISTINCT vendor_id FROM fin_company)
    ON CONFLICT (vendor_id, code) DO NOTHING
    """)

    x("""
    UPDATE fin_journal_entry je
    SET company_id = (
        SELECT id FROM fin_company c
        WHERE c.vendor_id = je.vendor_id AND c.is_default = TRUE
        LIMIT 1
    )
    WHERE je.company_id IS NULL
    """)

    # ── 7. Extend fin_journal_line ────────────────────────────────────────────
    for col_sql in [
        "ALTER TABLE fin_journal_line ADD COLUMN IF NOT EXISTS cost_center_id UUID REFERENCES fin_cost_center(id) ON DELETE SET NULL",
        "ALTER TABLE fin_journal_line ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES fin_project(id) ON DELETE SET NULL",
        "ALTER TABLE fin_journal_line ADD COLUMN IF NOT EXISTS intercompany_partner_id UUID REFERENCES fin_intercompany_partner(id) ON DELETE SET NULL",
        "ALTER TABLE fin_journal_line ADD COLUMN IF NOT EXISTS value_date DATE",
        "ALTER TABLE fin_journal_line ADD COLUMN IF NOT EXISTS ref_doc_type VARCHAR(40)",
        "ALTER TABLE fin_journal_line ADD COLUMN IF NOT EXISTS ref_doc_id UUID",
        "ALTER TABLE fin_journal_line ADD COLUMN IF NOT EXISTS ref_doc_no VARCHAR(100)",
        "ALTER TABLE fin_journal_line ADD COLUMN IF NOT EXISTS tax_code VARCHAR(20)",
        "ALTER TABLE fin_journal_line ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(18,4) NOT NULL DEFAULT 0",
        "ALTER TABLE fin_journal_line ADD COLUMN IF NOT EXISTS assignment VARCHAR(100)",
    ]:
        x(col_sql)


def downgrade() -> None:
    # Remove added columns from lines
    for col in ["assignment", "tax_amount", "tax_code", "ref_doc_no", "ref_doc_id",
                "ref_doc_type", "value_date", "intercompany_partner_id",
                "project_id", "cost_center_id"]:
        x(f"ALTER TABLE fin_journal_line DROP COLUMN IF EXISTS {col}")

    # Remove added columns from entries
    for col in ["approval_request_id", "requires_approval", "header_text",
                "document_type", "document_date", "company_id"]:
        x(f"ALTER TABLE fin_journal_entry DROP COLUMN IF EXISTS {col}")

    # Drop new tables (reverse dependency order)
    for tbl in ["fin_intercompany_partner", "fin_project", "fin_cost_center", "fin_company"]:
        x(f"DROP TABLE IF EXISTS {tbl} CASCADE")
