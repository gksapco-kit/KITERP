"""Sales Commission — seed default Commission Expense and Commission Payable GL accounts.

For each vendor that already has at least one FinAccount, this migration inserts:
  - Commission Expense   (type=expense,  code=6200)
  - Commission Payable   (type=liability, code=2400)

Revision ID: comm003_seed_accounts
Revises: comm002_sale_payee_columns
Create Date: 2026-04-22
"""

revision = "comm003_seed_accounts"
down_revision = "comm002_sale_payee_columns"
branch_labels = None
depends_on = None

from alembic import op


def upgrade() -> None:
    # Insert Commission Expense account for each vendor that has a COA but not yet this code
    op.execute("""
        INSERT INTO fin_account (
            id, vendor_id, code, name, account_type,
            is_system, is_active, opening_balance, created_at
        )
        SELECT
            gen_random_uuid(),
            v.id,
            '6200',
            'Commission Expense',
            'expense',
            TRUE,
            TRUE,
            0,
            NOW()
        FROM vendor v
        WHERE EXISTS (
            SELECT 1 FROM fin_account fa WHERE fa.vendor_id = v.id
        )
        AND NOT EXISTS (
            SELECT 1 FROM fin_account fa
            WHERE fa.vendor_id = v.id AND fa.code = '6200'
        )
    """)

    # Insert Commission Payable account
    op.execute("""
        INSERT INTO fin_account (
            id, vendor_id, code, name, account_type,
            is_system, is_active, opening_balance, created_at
        )
        SELECT
            gen_random_uuid(),
            v.id,
            '2400',
            'Commission Payable',
            'liability',
            TRUE,
            TRUE,
            0,
            NOW()
        FROM vendor v
        WHERE EXISTS (
            SELECT 1 FROM fin_account fa WHERE fa.vendor_id = v.id
        )
        AND NOT EXISTS (
            SELECT 1 FROM fin_account fa
            WHERE fa.vendor_id = v.id AND fa.code = '2400'
        )
    """)


def downgrade() -> None:
    op.execute("""
        DELETE FROM fin_account
        WHERE code IN ('6200', '2400')
        AND is_system = TRUE
        AND name IN ('Commission Expense', 'Commission Payable')
    """)
