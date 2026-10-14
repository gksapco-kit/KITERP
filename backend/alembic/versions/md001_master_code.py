"""Add short master_code to customer and supplier (C-0042, V-0007, …).

Revision ID: md001_master_code
Revises: cust003_customer_sales_area
Create Date: 2026-10-14
"""
from alembic import op

revision = "md001_master_code"
down_revision = "cust003_customer_sales_area"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return

    # ── customer → C-0001 ──────────────────────────────────────────
    op.execute("ALTER TABLE customer ADD COLUMN IF NOT EXISTS master_code VARCHAR(20);")
    op.execute("""
        WITH numbered AS (
            SELECT id,
                ROW_NUMBER() OVER (PARTITION BY vendor_id ORDER BY created_at, id) AS rn
            FROM customer
            WHERE master_code IS NULL
        )
        UPDATE customer t
        SET master_code = 'C-' || LPAD(numbered.rn::text, 4, '0')
        FROM numbered
        WHERE t.id = numbered.id;
    """)
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS ix_customer_vendor_master_code
        ON customer (vendor_id, master_code)
        WHERE master_code IS NOT NULL;
    """)

    # ── supplier → V-/E-/P-/CT- by party_type ──────────────────────
    op.execute("ALTER TABLE supplier ADD COLUMN IF NOT EXISTS master_code VARCHAR(20);")
    op.execute("""
        WITH numbered AS (
            SELECT id,
                party_type,
                ROW_NUMBER() OVER (
                    PARTITION BY vendor_id,
                        CASE party_type
                            WHEN 'employee' THEN 'E'
                            WHEN 'partner' THEN 'P'
                            WHEN 'contractor' THEN 'CT'
                            ELSE 'V'
                        END
                    ORDER BY created_at, id
                ) AS rn
            FROM supplier
            WHERE master_code IS NULL
        )
        UPDATE supplier t
        SET master_code = (
            CASE numbered.party_type
                WHEN 'employee' THEN 'E-'
                WHEN 'partner' THEN 'P-'
                WHEN 'contractor' THEN 'CT-'
                ELSE 'V-'
            END
        ) || LPAD(numbered.rn::text, 4, '0')
        FROM numbered
        WHERE t.id = numbered.id;
    """)
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS ix_supplier_vendor_master_code
        ON supplier (vendor_id, master_code)
        WHERE master_code IS NOT NULL;
    """)


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return
    op.execute("DROP INDEX IF EXISTS ix_customer_vendor_master_code;")
    op.execute("DROP INDEX IF EXISTS ix_supplier_vendor_master_code;")
    op.execute("ALTER TABLE customer DROP COLUMN IF EXISTS master_code;")
    op.execute("ALTER TABLE supplier DROP COLUMN IF EXISTS master_code;")
