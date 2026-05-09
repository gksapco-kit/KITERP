"""Store company code link — superseded; store.code is used as company code instead.

Revision ID: fin002_store_company_code
Revises: fin001_cost_center_group
Create Date: 2026-04-21
"""

revision = "fin002_store_company_code"
down_revision = "fin001_cost_center_group"
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass  # fin_company_id column not added; store.code serves as company code


def downgrade() -> None:
    pass
