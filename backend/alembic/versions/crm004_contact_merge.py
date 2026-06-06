"""Merge accounts into contacts: record_type, salutation, company fields, parent link.

Revision ID: crm004_contact_merge
Revises: crm003_entity_numbers
Create Date: 2026-06-06
"""
from alembic import op

revision = "crm004_contact_merge"
down_revision = "crm003_entity_numbers"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return

    op.execute("ALTER TABLE crm_contact ADD COLUMN IF NOT EXISTS record_type VARCHAR(10) DEFAULT 'person';")
    op.execute("ALTER TABLE crm_contact ADD COLUMN IF NOT EXISTS salutation VARCHAR(20);")
    op.execute("ALTER TABLE crm_contact ADD COLUMN IF NOT EXISTS parent_contact_id UUID REFERENCES crm_contact(id) ON DELETE SET NULL;")
    op.execute("ALTER TABLE crm_contact ADD COLUMN IF NOT EXISTS linked_account_id UUID REFERENCES crm_account(id) ON DELETE SET NULL;")
    op.execute("ALTER TABLE crm_contact ADD COLUMN IF NOT EXISTS number VARCHAR(40);")
    op.execute("ALTER TABLE crm_contact ADD COLUMN IF NOT EXISTS industry VARCHAR(100);")
    op.execute("ALTER TABLE crm_contact ADD COLUMN IF NOT EXISTS region VARCHAR(100);")
    op.execute("ALTER TABLE crm_contact ADD COLUMN IF NOT EXISTS website VARCHAR(500);")
    op.execute("ALTER TABLE crm_contact ADD COLUMN IF NOT EXISTS annual_revenue NUMERIC(14,2);")
    op.execute("ALTER TABLE crm_contact ADD COLUMN IF NOT EXISTS employee_count INTEGER;")
    op.execute("UPDATE crm_contact SET record_type = 'person' WHERE record_type IS NULL;")
    op.execute("CREATE INDEX IF NOT EXISTS ix_crm_contact_parent ON crm_contact(parent_contact_id);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_crm_contact_record_type ON crm_contact(vendor_id, record_type);")

    # Mirror existing accounts as company-type contacts (idempotent).
    op.execute("""
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
        WHERE NOT EXISTS (
            SELECT 1 FROM crm_contact c WHERE c.linked_account_id = a.id
        );
    """)

    # Link people to company contacts via parent_contact_id.
    op.execute("""
        UPDATE crm_contact p
        SET parent_contact_id = co.id
        FROM crm_contact co
        WHERE p.account_id IS NOT NULL
          AND co.linked_account_id = p.account_id
          AND co.record_type = 'company'
          AND p.record_type = 'person'
          AND p.parent_contact_id IS NULL;
    """)


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return
    op.execute("DROP INDEX IF EXISTS ix_crm_contact_record_type;")
    op.execute("DROP INDEX IF EXISTS ix_crm_contact_parent;")
    for col in (
        "employee_count", "annual_revenue", "website", "region", "industry",
        "number", "linked_account_id", "parent_contact_id", "salutation", "record_type",
    ):
        op.execute(f"ALTER TABLE crm_contact DROP COLUMN IF EXISTS {col};")
