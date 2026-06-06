"""Add vendor-scoped number columns to CRM accounts, leads, deals, and activities.

Revision ID: crm003_entity_numbers
Revises: crm002_activity_custom_fields
Create Date: 2026-06-06
"""
from alembic import op

revision = "crm003_entity_numbers"
down_revision = "crm002_activity_custom_fields"
branch_labels = None
depends_on = None

_ENTITIES = (
    ("crm_account", "ACC"),
    ("crm_lead", "LED"),
    ("crm_deal", "DEAL"),
    ("crm_activity", "TSK"),
)


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return

    for table, prefix in _ENTITIES:
        op.execute(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS number VARCHAR(40);")
        op.execute(f"""
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
        """)
        op.execute(f"ALTER TABLE {table} ALTER COLUMN number SET NOT NULL;")
        op.execute(
            f"CREATE UNIQUE INDEX IF NOT EXISTS ix_{table}_number "
            f"ON {table}(vendor_id, number);"
        )


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return

    for table, _ in _ENTITIES:
        op.execute(f"DROP INDEX IF EXISTS ix_{table}_number;")
        op.execute(f"ALTER TABLE {table} DROP COLUMN IF EXISTS number;")
