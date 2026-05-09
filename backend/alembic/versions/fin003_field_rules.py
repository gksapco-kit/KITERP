"""GL field configuration rules (scope: GL default, company, user).

Revision ID: fin003_field_rules
Revises: fin002_je_enterprise
"""
from alembic import op

revision = "fin003_field_rules"
down_revision = "fin002_je_enterprise"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # One statement per execute — asyncpg cannot run multiple commands in a single round-trip.
    op.execute("""
        CREATE TABLE IF NOT EXISTS fin_field_rule (
            id UUID PRIMARY KEY,
            vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
            scope VARCHAR(20) NOT NULL,
            company_id UUID REFERENCES fin_company(id) ON DELETE CASCADE,
            vendor_user_id UUID REFERENCES vendor_user(id) ON DELETE CASCADE,
            entity_type VARCHAR(50) NOT NULL,
            field_key VARCHAR(120) NOT NULL,
            requirement VARCHAR(20) NOT NULL,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ,
            CONSTRAINT ck_fin_field_rule_scope CHECK (
                (scope = 'gl' AND company_id IS NULL AND vendor_user_id IS NULL)
                OR (scope = 'company' AND company_id IS NOT NULL AND vendor_user_id IS NULL)
                OR (scope = 'user' AND vendor_user_id IS NOT NULL)
            )
        );
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_fin_field_rule_vendor ON fin_field_rule(vendor_id, entity_type);
    """)
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS uq_fin_field_rule_gl
            ON fin_field_rule (vendor_id, entity_type, field_key)
            WHERE scope = 'gl';
    """)
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS uq_fin_field_rule_company
            ON fin_field_rule (vendor_id, company_id, entity_type, field_key)
            WHERE scope = 'company';
    """)
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS uq_fin_field_rule_user
            ON fin_field_rule (vendor_id, vendor_user_id, entity_type, field_key)
            WHERE scope = 'user';
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS fin_field_rule CASCADE;")
