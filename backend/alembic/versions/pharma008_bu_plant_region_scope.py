"""Add region scope column to pharma_approval_rule.

Enables scoping approval / e-sign policies per BU + Plant + Region
combination.  region stores the track-and-trace region (us | eu | none)
as a nullable VARCHAR — NULL means the rule applies to any region.

Revision ID: pharma008_bu_plant_region_scope
Revises: pharma007_org_regions
Create Date: 2026-07-29
"""
from alembic import op
import sqlalchemy as sa

revision = "pharma008_bu_plant_region_scope"
down_revision = "merge002_pharma007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE pharma_approval_rule
        ADD COLUMN IF NOT EXISTS region VARCHAR(10)
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_pharma_appr_rule_region
        ON pharma_approval_rule (vendor_id, action, region)
        WHERE region IS NOT NULL
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_pharma_appr_rule_region")
    op.execute("ALTER TABLE pharma_approval_rule DROP COLUMN IF EXISTS region")
