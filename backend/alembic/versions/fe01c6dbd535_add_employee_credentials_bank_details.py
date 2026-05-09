"""add_employee_credentials_bank_details

Revision ID: fe01c6dbd535
Revises: ms002_merge_hr_and_store
Create Date: 2026-04-16 08:59:23.920678

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'fe01c6dbd535'
down_revision: Union[str, None] = 'ms002_merge_hr_and_store'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Use raw SQL with IF NOT EXISTS / IF EXISTS throughout to be idempotent
    # (loyalty_program, loyalty_account, loyalty_transaction already exist in DB)

    op.execute("""
        CREATE TABLE IF NOT EXISTS loyalty_program (
            id UUID NOT NULL,
            vendor_id UUID NOT NULL,
            is_active BOOLEAN,
            name VARCHAR(255),
            points_per_currency NUMERIC(10, 2),
            currency_per_point NUMERIC(10, 4),
            min_redeem_points INTEGER,
            max_redeem_percent INTEGER,
            signup_bonus INTEGER,
            tier_config JSONB,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now(),
            PRIMARY KEY (id),
            FOREIGN KEY (vendor_id) REFERENCES vendor(id)
        )
    """)
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS ix_loyalty_program_vendor_id ON loyalty_program (vendor_id)")

    op.execute("""
        CREATE TABLE IF NOT EXISTS loyalty_account (
            id UUID NOT NULL,
            vendor_id UUID NOT NULL,
            customer_id UUID NOT NULL,
            points_balance INTEGER,
            lifetime_earned INTEGER,
            lifetime_redeemed INTEGER,
            tier VARCHAR(50),
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now(),
            PRIMARY KEY (id),
            FOREIGN KEY (customer_id) REFERENCES customer(id),
            FOREIGN KEY (vendor_id) REFERENCES vendor(id)
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_loyalty_account_customer_id ON loyalty_account (customer_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_loyalty_account_vendor_id ON loyalty_account (vendor_id)")
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS uq_loyalty_vendor_customer ON loyalty_account (vendor_id, customer_id)")

    op.execute("""
        CREATE TABLE IF NOT EXISTS loyalty_transaction (
            id UUID NOT NULL,
            vendor_id UUID NOT NULL,
            customer_id UUID NOT NULL,
            account_id UUID NOT NULL,
            type VARCHAR(20) NOT NULL,
            points INTEGER NOT NULL,
            balance_after INTEGER NOT NULL,
            description TEXT,
            reference_type VARCHAR(30),
            reference_id UUID,
            created_at TIMESTAMPTZ DEFAULT now(),
            PRIMARY KEY (id),
            FOREIGN KEY (account_id) REFERENCES loyalty_account(id),
            FOREIGN KEY (customer_id) REFERENCES customer(id),
            FOREIGN KEY (vendor_id) REFERENCES vendor(id)
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_loyalty_transaction_customer_id ON loyalty_transaction (customer_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_loyalty_transaction_vendor_id ON loyalty_transaction (vendor_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_loyalty_txn_customer ON loyalty_transaction (customer_id, created_at)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_loyalty_txn_vendor ON loyalty_transaction (vendor_id, created_at)")

    # Bundle
    op.execute("CREATE INDEX IF NOT EXISTS idx_bundle_active ON bundle (vendor_id, is_active)")
    op.execute("ALTER TABLE bundle_item DROP CONSTRAINT IF EXISTS bundle_item_bundle_id_product_id_key")
    op.execute("CREATE INDEX IF NOT EXISTS idx_bundle_item_bundle ON bundle_item (bundle_id)")
    op.execute("""
        DO $$ BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'uq_bundle_product'
            ) THEN
                ALTER TABLE bundle_item ADD CONSTRAINT uq_bundle_product UNIQUE (bundle_id, product_id);
            END IF;
        END $$
    """)

    # Customer bank columns
    op.execute("ALTER TABLE customer ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100)")
    op.execute("ALTER TABLE customer ADD COLUMN IF NOT EXISTS account_number VARCHAR(30)")
    op.execute("ALTER TABLE customer ADD COLUMN IF NOT EXISTS account_holder_name VARCHAR(255)")
    op.execute("ALTER TABLE customer ADD COLUMN IF NOT EXISTS account_type VARCHAR(20)")
    op.execute("ALTER TABLE customer ADD COLUMN IF NOT EXISTS ifsc_code VARCHAR(15)")

    # HR indexes
    op.execute("CREATE INDEX IF NOT EXISTS ix_hr_attendance_record_employee_id ON hr_attendance_record (employee_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_hr_department_vendor_id ON hr_department (vendor_id)")
    op.execute("DROP INDEX IF EXISTS ix_hr_desig_vendor")
    op.execute("CREATE INDEX IF NOT EXISTS ix_hr_designation_vendor_id ON hr_designation (vendor_id)")
    op.execute("DROP INDEX IF EXISTS ix_hr_doc_employee")
    op.execute("CREATE INDEX IF NOT EXISTS ix_hr_employee_document_employee_id ON hr_employee_document (employee_id)")

    # HR employee profile new columns
    op.execute("ALTER TABLE hr_employee_profile ADD COLUMN IF NOT EXISTS employee_code_custom VARCHAR(50)")
    op.execute("ALTER TABLE hr_employee_profile ADD COLUMN IF NOT EXISTS pos_pin_hash VARCHAR(255)")
    op.execute("ALTER TABLE hr_employee_profile ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES store(id) ON DELETE SET NULL")
    op.execute("ALTER TABLE hr_employee_profile ADD COLUMN IF NOT EXISTS account_holder_name VARCHAR(255)")
    op.execute("ALTER TABLE hr_employee_profile ADD COLUMN IF NOT EXISTS account_type VARCHAR(20)")
    op.execute("ALTER TABLE hr_employee_profile ADD COLUMN IF NOT EXISTS aadhaar_number VARCHAR(12)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_hr_employee_profile_vendor_id ON hr_employee_profile (vendor_id)")

    # More HR indexes
    op.execute("DROP INDEX IF EXISTS ix_hr_holiday_vendor_year")
    op.execute("CREATE INDEX IF NOT EXISTS ix_hr_holiday_vendor_id ON hr_holiday (vendor_id)")
    op.execute("DROP INDEX IF EXISTS ix_hr_leave_policy_vendor")
    op.execute("CREATE INDEX IF NOT EXISTS ix_hr_leave_policy_vendor_id ON hr_leave_policy (vendor_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_hr_leave_request_employee_id ON hr_leave_request (employee_id)")
    op.execute("DROP INDEX IF EXISTS ix_hr_offer_vendor")
    op.execute("CREATE INDEX IF NOT EXISTS ix_hr_offer_letter_vendor_id ON hr_offer_letter (vendor_id)")
    op.execute("DROP INDEX IF EXISTS ix_hr_payslip_employee")
    op.execute("DROP INDEX IF EXISTS ix_hr_payslip_run")
    op.execute("CREATE INDEX IF NOT EXISTS ix_hr_payroll_entry_employee_id ON hr_payroll_entry (employee_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_hr_payroll_entry_payroll_run_id ON hr_payroll_entry (payroll_run_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_hr_payroll_run_vendor_id ON hr_payroll_run (vendor_id)")
    op.execute("DROP INDEX IF EXISTS ix_hr_salary_employee")
    op.execute("CREATE INDEX IF NOT EXISTS ix_hr_salary_structure_employee_id ON hr_salary_structure (employee_id)")

    # Order columns — alter nullable
    op.alter_column('order', 'cancel_attachments',
               existing_type=postgresql.JSONB(astext_type=sa.Text()),
               nullable=True,
               existing_server_default=sa.text("'[]'::jsonb"))
    op.alter_column('order', 'return_attachments',
               existing_type=postgresql.JSONB(astext_type=sa.Text()),
               nullable=True,
               existing_server_default=sa.text("'[]'::jsonb"))

    # POS transaction columns
    op.execute("ALTER TABLE pos_transaction ADD COLUMN IF NOT EXISTS coupon_code VARCHAR(50)")
    op.execute("ALTER TABLE pos_transaction ADD COLUMN IF NOT EXISTS coupon_discount NUMERIC(12, 2)")
    op.execute("ALTER TABLE pos_transaction ADD COLUMN IF NOT EXISTS loyalty_points_redeemed INTEGER")
    op.execute("ALTER TABLE pos_transaction ADD COLUMN IF NOT EXISTS loyalty_points_earned INTEGER")
    op.execute("ALTER TABLE pos_transaction ADD COLUMN IF NOT EXISTS loyalty_discount NUMERIC(12, 2)")

    # Service booking_lead_time_hours type change
    op.execute("ALTER TABLE service ALTER COLUMN booking_lead_time_hours TYPE FLOAT USING booking_lead_time_hours::float")
    op.execute("ALTER TABLE service_plan ALTER COLUMN booking_lead_time_hours TYPE FLOAT USING booking_lead_time_hours::float")

    # Supplier bank columns
    op.execute("ALTER TABLE supplier ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100)")
    op.execute("ALTER TABLE supplier ADD COLUMN IF NOT EXISTS account_number VARCHAR(30)")
    op.execute("ALTER TABLE supplier ADD COLUMN IF NOT EXISTS account_holder_name VARCHAR(255)")
    op.execute("ALTER TABLE supplier ADD COLUMN IF NOT EXISTS account_type VARCHAR(20)")
    op.execute("ALTER TABLE supplier ADD COLUMN IF NOT EXISTS ifsc_code VARCHAR(15)")

    # Upsell
    op.execute("ALTER TABLE upsell_mapping DROP CONSTRAINT IF EXISTS upsell_mapping_source_product_id_target_product_id_relation_key")
    op.execute("CREATE INDEX IF NOT EXISTS idx_upsell_bundle ON upsell_mapping (bundle_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_upsell_target ON upsell_mapping (target_product_id)")

    # Vendor
    op.alter_column('vendor', 'order_acceptance_enabled',
               existing_type=sa.BOOLEAN(),
               nullable=True,
               existing_server_default=sa.text('true'))
    op.execute("DROP INDEX IF EXISTS idx_vendor_approved_location")
    op.execute("DROP INDEX IF EXISTS idx_vendor_lat_lon")
    op.execute("DROP INDEX IF EXISTS idx_vendor_user_store")

    # vendor_user.role_name
    op.execute("ALTER TABLE vendor_user DROP COLUMN IF EXISTS role_name")


def downgrade() -> None:
    op.add_column('vendor_user', sa.Column('role_name', sa.VARCHAR(length=100), autoincrement=False, nullable=True))
    op.create_index('idx_vendor_user_store', 'vendor_user', ['store_id'], unique=False)
    op.create_index('idx_vendor_lat_lon', 'vendor', ['latitude', 'longitude'], unique=False, postgresql_where='((latitude IS NOT NULL) AND (longitude IS NOT NULL))')
    op.create_index('idx_vendor_approved_location', 'vendor', ['status', 'latitude', 'longitude'], unique=False, postgresql_where="(((status)::text = 'approved'::text) AND (latitude IS NOT NULL) AND (longitude IS NOT NULL))")
    op.alter_column('vendor', 'order_acceptance_enabled',
               existing_type=sa.BOOLEAN(),
               nullable=False,
               existing_server_default=sa.text('true'))
    op.drop_index('idx_upsell_target', table_name='upsell_mapping')
    op.drop_index('idx_upsell_bundle', table_name='upsell_mapping')
    op.create_unique_constraint('upsell_mapping_source_product_id_target_product_id_relation_key', 'upsell_mapping', ['source_product_id', 'target_product_id', 'relation_type'], postgresql_nulls_not_distinct=False)
    op.drop_column('supplier', 'ifsc_code')
    op.drop_column('supplier', 'account_type')
    op.drop_column('supplier', 'account_holder_name')
    op.drop_column('supplier', 'account_number')
    op.drop_column('supplier', 'bank_name')
    op.alter_column('service_plan', 'booking_lead_time_hours',
               existing_type=sa.Float(),
               type_=sa.INTEGER(),
               existing_nullable=True)
    op.alter_column('service', 'booking_lead_time_hours',
               existing_type=sa.Float(),
               type_=sa.INTEGER(),
               existing_nullable=True)
    op.drop_column('pos_transaction', 'loyalty_discount')
    op.drop_column('pos_transaction', 'loyalty_points_earned')
    op.drop_column('pos_transaction', 'loyalty_points_redeemed')
    op.drop_column('pos_transaction', 'coupon_discount')
    op.drop_column('pos_transaction', 'coupon_code')
    op.alter_column('order', 'return_attachments',
               existing_type=postgresql.JSONB(astext_type=sa.Text()),
               nullable=False,
               existing_server_default=sa.text("'[]'::jsonb"))
    op.alter_column('order', 'cancel_attachments',
               existing_type=postgresql.JSONB(astext_type=sa.Text()),
               nullable=False,
               existing_server_default=sa.text("'[]'::jsonb"))
    op.drop_index(op.f('ix_hr_salary_structure_employee_id'), table_name='hr_salary_structure')
    op.create_index('ix_hr_salary_employee', 'hr_salary_structure', ['employee_id', 'is_active'], unique=False)
    op.drop_index(op.f('ix_hr_payroll_run_vendor_id'), table_name='hr_payroll_run')
    op.drop_index(op.f('ix_hr_payroll_entry_payroll_run_id'), table_name='hr_payroll_entry')
    op.drop_index(op.f('ix_hr_payroll_entry_employee_id'), table_name='hr_payroll_entry')
    op.create_index('ix_hr_payslip_run', 'hr_payroll_entry', ['payroll_run_id'], unique=False)
    op.create_index('ix_hr_payslip_employee', 'hr_payroll_entry', ['employee_id'], unique=False)
    op.drop_index(op.f('ix_hr_offer_letter_vendor_id'), table_name='hr_offer_letter')
    op.create_index('ix_hr_offer_vendor', 'hr_offer_letter', ['vendor_id'], unique=False)
    op.drop_index(op.f('ix_hr_leave_request_employee_id'), table_name='hr_leave_request')
    op.drop_index(op.f('ix_hr_leave_policy_vendor_id'), table_name='hr_leave_policy')
    op.create_index('ix_hr_leave_policy_vendor', 'hr_leave_policy', ['vendor_id'], unique=False)
    op.drop_index(op.f('ix_hr_holiday_vendor_id'), table_name='hr_holiday')
    op.create_index('ix_hr_holiday_vendor_year', 'hr_holiday', ['vendor_id', 'year'], unique=False)
    op.drop_constraint(None, 'hr_employee_profile', type_='foreignkey')
    op.drop_index(op.f('ix_hr_employee_profile_vendor_id'), table_name='hr_employee_profile')
    op.drop_column('hr_employee_profile', 'aadhaar_number')
    op.drop_column('hr_employee_profile', 'account_type')
    op.drop_column('hr_employee_profile', 'account_holder_name')
    op.drop_column('hr_employee_profile', 'store_id')
    op.drop_column('hr_employee_profile', 'pos_pin_hash')
    op.drop_column('hr_employee_profile', 'employee_code_custom')
    op.drop_index(op.f('ix_hr_employee_document_employee_id'), table_name='hr_employee_document')
    op.create_index('ix_hr_doc_employee', 'hr_employee_document', ['employee_id'], unique=False)
    op.drop_index(op.f('ix_hr_designation_vendor_id'), table_name='hr_designation')
    op.create_index('ix_hr_desig_vendor', 'hr_designation', ['vendor_id'], unique=False)
    op.drop_index(op.f('ix_hr_department_vendor_id'), table_name='hr_department')
    op.drop_index(op.f('ix_hr_attendance_record_employee_id'), table_name='hr_attendance_record')
    op.drop_column('customer', 'ifsc_code')
    op.drop_column('customer', 'account_type')
    op.drop_column('customer', 'account_holder_name')
    op.drop_column('customer', 'account_number')
    op.drop_column('customer', 'bank_name')
    op.drop_constraint('uq_bundle_product', 'bundle_item', type_='unique')
    op.drop_index('idx_bundle_item_bundle', table_name='bundle_item')
    op.create_unique_constraint('bundle_item_bundle_id_product_id_key', 'bundle_item', ['bundle_id', 'product_id'], postgresql_nulls_not_distinct=False)
    op.drop_index('idx_bundle_active', table_name='bundle')
    op.drop_index('ix_loyalty_txn_vendor', table_name='loyalty_transaction')
    op.drop_index('ix_loyalty_txn_customer', table_name='loyalty_transaction')
    op.drop_index(op.f('ix_loyalty_transaction_vendor_id'), table_name='loyalty_transaction')
    op.drop_index(op.f('ix_loyalty_transaction_customer_id'), table_name='loyalty_transaction')
    op.drop_table('loyalty_transaction')
    op.drop_index('uq_loyalty_vendor_customer', table_name='loyalty_account')
    op.drop_index(op.f('ix_loyalty_account_vendor_id'), table_name='loyalty_account')
    op.drop_index(op.f('ix_loyalty_account_customer_id'), table_name='loyalty_account')
    op.drop_table('loyalty_account')
    op.drop_index(op.f('ix_loyalty_program_vendor_id'), table_name='loyalty_program')
    op.drop_table('loyalty_program')
