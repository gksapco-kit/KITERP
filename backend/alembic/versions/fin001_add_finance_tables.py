"""Add full Finance module tables (COA, GL, AR, AP, Bank, Budget, Assets, Tax, Capital, Controls).

Revision ID: fin001_add_finance_tables
Revises: crm001_add_crm_tables
Create Date: 2026-04-18

All statements use IF NOT EXISTS so this migration is safe to run on databases
where tables may already exist.
"""
from alembic import op

revision = "fin001_add_finance_tables"
down_revision = "crm001_add_crm_tables"
branch_labels = None
depends_on = None


def x(sql: str) -> None:
    """Execute a single SQL statement."""
    op.execute(sql.strip())


def upgrade() -> None:
    # ── Chart of Accounts ──────────────────────────────────────────────────
    x("""CREATE TABLE IF NOT EXISTS fin_account (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
        parent_id UUID REFERENCES fin_account(id) ON DELETE SET NULL,
        code VARCHAR(20) NOT NULL,
        name VARCHAR(200) NOT NULL,
        account_type VARCHAR(30) NOT NULL,
        account_subtype VARCHAR(50),
        currency VARCHAR(3) DEFAULT 'INR',
        description TEXT,
        is_reconcilable BOOLEAN DEFAULT FALSE,
        is_active BOOLEAN DEFAULT TRUE,
        is_system BOOLEAN DEFAULT FALSE,
        cost_center_id UUID REFERENCES store(id) ON DELETE SET NULL,
        opening_balance NUMERIC(18,4) DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT now()
    )""")
    x("CREATE UNIQUE INDEX IF NOT EXISTS uq_fin_account_vendor_code ON fin_account(vendor_id, code)")
    x("CREATE INDEX IF NOT EXISTS ix_fin_account_vendor ON fin_account(vendor_id)")

    # ── Fiscal Year ─────────────────────────────────────────────────────────
    x("""CREATE TABLE IF NOT EXISTS fin_fiscal_year (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
        name VARCHAR(50) NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        status VARCHAR(20) DEFAULT 'open',
        is_current BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT now()
    )""")
    x("CREATE INDEX IF NOT EXISTS ix_fin_fiscal_year_vendor ON fin_fiscal_year(vendor_id)")

    # ── Period ──────────────────────────────────────────────────────────────
    x("""CREATE TABLE IF NOT EXISTS fin_period (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
        fiscal_year_id UUID NOT NULL REFERENCES fin_fiscal_year(id) ON DELETE CASCADE,
        name VARCHAR(30) NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        period_number INTEGER,
        status VARCHAR(20) DEFAULT 'open',
        closed_at TIMESTAMPTZ,
        closed_by_id UUID REFERENCES vendor_user(id) ON DELETE SET NULL
    )""")
    x("CREATE INDEX IF NOT EXISTS ix_fin_period_vendor ON fin_period(vendor_id)")
    x("CREATE INDEX IF NOT EXISTS ix_fin_period_fy ON fin_period(fiscal_year_id)")

    # ── Exchange Rates ──────────────────────────────────────────────────────
    x("""CREATE TABLE IF NOT EXISTS fin_exchange_rate (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
        from_currency VARCHAR(3) NOT NULL,
        to_currency VARCHAR(3) NOT NULL,
        rate NUMERIC(18,8) NOT NULL,
        effective_date DATE NOT NULL,
        source VARCHAR(30) DEFAULT 'manual',
        created_at TIMESTAMPTZ DEFAULT now()
    )""")
    x("CREATE UNIQUE INDEX IF NOT EXISTS uq_fin_fx_rate ON fin_exchange_rate(vendor_id, from_currency, to_currency, effective_date)")

    # ── Recurring Template ──────────────────────────────────────────────────
    x("""CREATE TABLE IF NOT EXISTS fin_recurring_template (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
        name VARCHAR(200) NOT NULL,
        frequency VARCHAR(20) DEFAULT 'monthly',
        next_run_date DATE,
        end_date DATE,
        is_active BOOLEAN DEFAULT TRUE,
        template_lines JSONB DEFAULT '[]',
        created_at TIMESTAMPTZ DEFAULT now()
    )""")
    x("CREATE INDEX IF NOT EXISTS ix_fin_recurring_vendor ON fin_recurring_template(vendor_id)")

    # ── Journal Entry ───────────────────────────────────────────────────────
    x("""CREATE TABLE IF NOT EXISTS fin_journal_entry (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
        entry_no VARCHAR(30) NOT NULL,
        entry_date DATE NOT NULL,
        period_id UUID REFERENCES fin_period(id) ON DELETE SET NULL,
        fiscal_year_id UUID REFERENCES fin_fiscal_year(id) ON DELETE SET NULL,
        source_type VARCHAR(40),
        source_id UUID,
        status VARCHAR(20) DEFAULT 'draft',
        narration TEXT,
        reference VARCHAR(100),
        currency VARCHAR(3) DEFAULT 'INR',
        total_debit NUMERIC(18,4) DEFAULT 0,
        total_credit NUMERIC(18,4) DEFAULT 0,
        is_recurring BOOLEAN DEFAULT FALSE,
        recurring_template_id UUID REFERENCES fin_recurring_template(id) ON DELETE SET NULL,
        reversed_by_id UUID,
        reverses_id UUID,
        created_by_id UUID REFERENCES vendor_user(id) ON DELETE SET NULL,
        posted_by_id UUID REFERENCES vendor_user(id) ON DELETE SET NULL,
        posted_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
    )""")
    x("CREATE UNIQUE INDEX IF NOT EXISTS uq_fin_je_vendor_entry_no ON fin_journal_entry(vendor_id, entry_no)")
    x("CREATE INDEX IF NOT EXISTS ix_fin_je_vendor ON fin_journal_entry(vendor_id)")
    x("CREATE INDEX IF NOT EXISTS ix_fin_je_date ON fin_journal_entry(entry_date)")
    x("CREATE INDEX IF NOT EXISTS ix_fin_je_status ON fin_journal_entry(status)")
    x("CREATE INDEX IF NOT EXISTS ix_fin_je_source ON fin_journal_entry(source_type, source_id, vendor_id)")

    # ── Journal Line ────────────────────────────────────────────────────────
    x("""CREATE TABLE IF NOT EXISTS fin_journal_line (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        journal_entry_id UUID NOT NULL REFERENCES fin_journal_entry(id) ON DELETE CASCADE,
        vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
        account_id UUID NOT NULL REFERENCES fin_account(id) ON DELETE RESTRICT,
        store_id UUID REFERENCES store(id) ON DELETE SET NULL,
        party_type VARCHAR(20),
        party_id UUID,
        debit NUMERIC(18,4) DEFAULT 0,
        credit NUMERIC(18,4) DEFAULT 0,
        currency VARCHAR(3) DEFAULT 'INR',
        fx_rate NUMERIC(18,8) DEFAULT 1,
        base_debit NUMERIC(18,4) DEFAULT 0,
        base_credit NUMERIC(18,4) DEFAULT 0,
        narration TEXT,
        sequence INTEGER DEFAULT 0
    )""")
    x("CREATE INDEX IF NOT EXISTS ix_fin_jl_entry ON fin_journal_line(journal_entry_id)")
    x("CREATE INDEX IF NOT EXISTS ix_fin_jl_account ON fin_journal_line(account_id)")
    x("CREATE INDEX IF NOT EXISTS ix_fin_jl_vendor ON fin_journal_line(vendor_id)")

    # ── AR: Payment Application ─────────────────────────────────────────────
    x("""CREATE TABLE IF NOT EXISTS fin_customer_payment_application (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
        payment_id UUID NOT NULL REFERENCES payment(id) ON DELETE CASCADE,
        invoice_id UUID NOT NULL REFERENCES invoice(id) ON DELETE CASCADE,
        amount_applied NUMERIC(18,4) NOT NULL,
        applied_at TIMESTAMPTZ DEFAULT now(),
        created_by_id UUID REFERENCES vendor_user(id) ON DELETE SET NULL
    )""")
    x("CREATE INDEX IF NOT EXISTS ix_fin_cpa_vendor ON fin_customer_payment_application(vendor_id)")
    x("CREATE INDEX IF NOT EXISTS ix_fin_cpa_payment ON fin_customer_payment_application(payment_id)")
    x("CREATE INDEX IF NOT EXISTS ix_fin_cpa_invoice ON fin_customer_payment_application(invoice_id)")

    # ── AR: Aging Snapshot ──────────────────────────────────────────────────
    x("""CREATE TABLE IF NOT EXISTS fin_ar_aging_snapshot (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
        snapshot_date DATE NOT NULL,
        customer_id UUID REFERENCES customer(id) ON DELETE CASCADE,
        current_amt NUMERIC(18,4) DEFAULT 0,
        days_1_30 NUMERIC(18,4) DEFAULT 0,
        days_31_60 NUMERIC(18,4) DEFAULT 0,
        days_61_90 NUMERIC(18,4) DEFAULT 0,
        days_90_plus NUMERIC(18,4) DEFAULT 0,
        total_outstanding NUMERIC(18,4) DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT now()
    )""")
    x("CREATE INDEX IF NOT EXISTS ix_fin_ar_aging_vendor ON fin_ar_aging_snapshot(vendor_id)")

    # ── Bank Account (must precede vendor payment & payment run) ────────────
    x("""CREATE TABLE IF NOT EXISTS fin_bank_account (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
        gl_account_id UUID REFERENCES fin_account(id) ON DELETE RESTRICT,
        name VARCHAR(200) NOT NULL,
        account_type VARCHAR(20) DEFAULT 'bank',
        bank_name VARCHAR(200),
        account_number VARCHAR(50),
        ifsc_code VARCHAR(20),
        currency VARCHAR(3) DEFAULT 'INR',
        opening_balance NUMERIC(18,4) DEFAULT 0,
        current_balance NUMERIC(18,4) DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,
        last_reconciled_date DATE,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT now()
    )""")
    x("CREATE INDEX IF NOT EXISTS ix_fin_ba_vendor ON fin_bank_account(vendor_id)")

    # ── AP: Vendor Bill ─────────────────────────────────────────────────────
    x("""CREATE TABLE IF NOT EXISTS fin_vendor_bill (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
        supplier_id UUID NOT NULL REFERENCES supplier(id) ON DELETE RESTRICT,
        po_id UUID REFERENCES purchase_order(id) ON DELETE SET NULL,
        bill_no VARCHAR(50) NOT NULL,
        bill_date DATE NOT NULL,
        due_date DATE,
        subtotal NUMERIC(18,4) DEFAULT 0,
        tax_amount NUMERIC(18,4) DEFAULT 0,
        total NUMERIC(18,4) DEFAULT 0,
        amount_paid NUMERIC(18,4) DEFAULT 0,
        balance_due NUMERIC(18,4) DEFAULT 0,
        status VARCHAR(20) DEFAULT 'draft',
        notes TEXT,
        attachment_url VARCHAR(500),
        currency VARCHAR(3) DEFAULT 'INR',
        journal_entry_id UUID REFERENCES fin_journal_entry(id) ON DELETE SET NULL,
        created_by_id UUID REFERENCES vendor_user(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
    )""")
    x("CREATE INDEX IF NOT EXISTS ix_fin_vb_vendor ON fin_vendor_bill(vendor_id)")
    x("CREATE INDEX IF NOT EXISTS ix_fin_vb_supplier ON fin_vendor_bill(supplier_id)")

    x("""CREATE TABLE IF NOT EXISTS fin_vendor_bill_line (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        bill_id UUID NOT NULL REFERENCES fin_vendor_bill(id) ON DELETE CASCADE,
        account_id UUID REFERENCES fin_account(id) ON DELETE RESTRICT,
        description VARCHAR(500),
        quantity NUMERIC(12,4) DEFAULT 1,
        unit_price NUMERIC(18,4) DEFAULT 0,
        tax_rate NUMERIC(6,4) DEFAULT 0,
        tax_amount NUMERIC(18,4) DEFAULT 0,
        line_total NUMERIC(18,4) DEFAULT 0,
        hsn_sac VARCHAR(20),
        sequence INTEGER DEFAULT 0
    )""")
    x("CREATE INDEX IF NOT EXISTS ix_fin_vbl_bill ON fin_vendor_bill_line(bill_id)")

    # ── AP: Payment Run ─────────────────────────────────────────────────────
    x("""CREATE TABLE IF NOT EXISTS fin_payment_run (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
        name VARCHAR(200),
        payment_date DATE NOT NULL,
        bank_account_id UUID REFERENCES fin_bank_account(id) ON DELETE SET NULL,
        total_amount NUMERIC(18,4) DEFAULT 0,
        status VARCHAR(20) DEFAULT 'draft',
        notes TEXT,
        created_by_id UUID REFERENCES vendor_user(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT now()
    )""")
    x("CREATE INDEX IF NOT EXISTS ix_fin_pr_vendor ON fin_payment_run(vendor_id)")

    x("""CREATE TABLE IF NOT EXISTS fin_vendor_payment (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
        supplier_id UUID NOT NULL REFERENCES supplier(id) ON DELETE RESTRICT,
        bill_id UUID REFERENCES fin_vendor_bill(id) ON DELETE SET NULL,
        payment_run_id UUID REFERENCES fin_payment_run(id) ON DELETE SET NULL,
        payment_date DATE NOT NULL,
        amount NUMERIC(18,4) NOT NULL,
        payment_method VARCHAR(30) DEFAULT 'bank_transfer',
        reference_no VARCHAR(100),
        bank_account_id UUID REFERENCES fin_bank_account(id) ON DELETE SET NULL,
        journal_entry_id UUID REFERENCES fin_journal_entry(id) ON DELETE SET NULL,
        notes TEXT,
        status VARCHAR(20) DEFAULT 'pending',
        created_by_id UUID REFERENCES vendor_user(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT now()
    )""")
    x("CREATE INDEX IF NOT EXISTS ix_fin_vp_vendor ON fin_vendor_payment(vendor_id)")
    x("CREATE INDEX IF NOT EXISTS ix_fin_vp_supplier ON fin_vendor_payment(supplier_id)")

    x("""CREATE TABLE IF NOT EXISTS fin_payment_run_item (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        run_id UUID NOT NULL REFERENCES fin_payment_run(id) ON DELETE CASCADE,
        bill_id UUID NOT NULL REFERENCES fin_vendor_bill(id) ON DELETE CASCADE,
        amount NUMERIC(18,4) NOT NULL,
        is_included BOOLEAN DEFAULT TRUE
    )""")
    x("CREATE INDEX IF NOT EXISTS ix_fin_pri_run ON fin_payment_run_item(run_id)")

    x("""CREATE TABLE IF NOT EXISTS fin_ap_aging_snapshot (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
        snapshot_date DATE NOT NULL,
        supplier_id UUID REFERENCES supplier(id) ON DELETE CASCADE,
        current_amt NUMERIC(18,4) DEFAULT 0,
        days_1_30 NUMERIC(18,4) DEFAULT 0,
        days_31_60 NUMERIC(18,4) DEFAULT 0,
        days_61_90 NUMERIC(18,4) DEFAULT 0,
        days_90_plus NUMERIC(18,4) DEFAULT 0,
        total_outstanding NUMERIC(18,4) DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT now()
    )""")
    x("CREATE INDEX IF NOT EXISTS ix_fin_ap_aging_vendor ON fin_ap_aging_snapshot(vendor_id)")

    # ── Bank Statement ──────────────────────────────────────────────────────
    x("""CREATE TABLE IF NOT EXISTS fin_bank_statement (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
        bank_account_id UUID NOT NULL REFERENCES fin_bank_account(id) ON DELETE CASCADE,
        statement_date DATE NOT NULL,
        from_date DATE,
        to_date DATE,
        closing_balance NUMERIC(18,4),
        source VARCHAR(20) DEFAULT 'manual',
        raw_data JSONB,
        created_at TIMESTAMPTZ DEFAULT now()
    )""")
    x("CREATE INDEX IF NOT EXISTS ix_fin_bs_vendor ON fin_bank_statement(vendor_id)")
    x("CREATE INDEX IF NOT EXISTS ix_fin_bs_account ON fin_bank_statement(bank_account_id)")

    x("""CREATE TABLE IF NOT EXISTS fin_bank_reconciliation (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
        bank_account_id UUID NOT NULL REFERENCES fin_bank_account(id) ON DELETE CASCADE,
        reconciliation_date DATE NOT NULL,
        statement_balance NUMERIC(18,4),
        book_balance NUMERIC(18,4),
        difference NUMERIC(18,4) DEFAULT 0,
        status VARCHAR(20) DEFAULT 'open',
        notes TEXT,
        completed_by_id UUID REFERENCES vendor_user(id) ON DELETE SET NULL,
        completed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT now()
    )""")
    x("CREATE INDEX IF NOT EXISTS ix_fin_br_vendor ON fin_bank_reconciliation(vendor_id)")

    x("""CREATE TABLE IF NOT EXISTS fin_bank_statement_line (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        statement_id UUID NOT NULL REFERENCES fin_bank_statement(id) ON DELETE CASCADE,
        vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
        transaction_date DATE NOT NULL,
        description TEXT,
        reference VARCHAR(200),
        debit NUMERIC(18,4) DEFAULT 0,
        credit NUMERIC(18,4) DEFAULT 0,
        balance NUMERIC(18,4),
        is_reconciled BOOLEAN DEFAULT FALSE,
        reconciliation_id UUID REFERENCES fin_bank_reconciliation(id) ON DELETE SET NULL
    )""")
    x("CREATE INDEX IF NOT EXISTS ix_fin_bsl_statement ON fin_bank_statement_line(statement_id)")
    x("CREATE INDEX IF NOT EXISTS ix_fin_bsl_vendor ON fin_bank_statement_line(vendor_id)")

    x("""CREATE TABLE IF NOT EXISTS fin_reconciliation_match (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        reconciliation_id UUID NOT NULL REFERENCES fin_bank_reconciliation(id) ON DELETE CASCADE,
        statement_line_id UUID REFERENCES fin_bank_statement_line(id) ON DELETE CASCADE,
        journal_line_id UUID REFERENCES fin_journal_line(id) ON DELETE CASCADE,
        amount NUMERIC(18,4),
        match_type VARCHAR(20) DEFAULT 'exact'
    )""")
    x("CREATE INDEX IF NOT EXISTS ix_fin_rm_recon ON fin_reconciliation_match(reconciliation_id)")

    # ── Budget & Forecast ───────────────────────────────────────────────────
    x("""CREATE TABLE IF NOT EXISTS fin_budget (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
        fiscal_year_id UUID NOT NULL REFERENCES fin_fiscal_year(id) ON DELETE RESTRICT,
        name VARCHAR(200) NOT NULL,
        scope VARCHAR(20) DEFAULT 'company',
        scope_id UUID,
        status VARCHAR(20) DEFAULT 'draft',
        notes TEXT,
        total_income NUMERIC(18,4) DEFAULT 0,
        total_expense NUMERIC(18,4) DEFAULT 0,
        created_by_id UUID REFERENCES vendor_user(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
    )""")
    x("CREATE INDEX IF NOT EXISTS ix_fin_budget_vendor ON fin_budget(vendor_id)")

    x("""CREATE TABLE IF NOT EXISTS fin_budget_line (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        budget_id UUID NOT NULL REFERENCES fin_budget(id) ON DELETE CASCADE,
        account_id UUID NOT NULL REFERENCES fin_account(id) ON DELETE RESTRICT,
        period_id UUID REFERENCES fin_period(id) ON DELETE RESTRICT,
        amount NUMERIC(18,4) DEFAULT 0,
        notes TEXT
    )""")
    x("CREATE INDEX IF NOT EXISTS ix_fin_bl_budget ON fin_budget_line(budget_id)")

    x("""CREATE TABLE IF NOT EXISTS fin_forecast (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
        name VARCHAR(200) NOT NULL,
        forecast_type VARCHAR(20) DEFAULT 'monthly',
        base_date DATE NOT NULL,
        months_ahead INTEGER DEFAULT 12,
        method VARCHAR(30) DEFAULT 'manual',
        status VARCHAR(20) DEFAULT 'draft',
        notes TEXT,
        created_by_id UUID REFERENCES vendor_user(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT now()
    )""")
    x("CREATE INDEX IF NOT EXISTS ix_fin_forecast_vendor ON fin_forecast(vendor_id)")

    x("""CREATE TABLE IF NOT EXISTS fin_forecast_line (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        forecast_id UUID NOT NULL REFERENCES fin_forecast(id) ON DELETE CASCADE,
        account_id UUID NOT NULL REFERENCES fin_account(id) ON DELETE RESTRICT,
        period_start DATE NOT NULL,
        amount NUMERIC(18,4) DEFAULT 0,
        notes TEXT
    )""")
    x("CREATE INDEX IF NOT EXISTS ix_fin_fl_forecast ON fin_forecast_line(forecast_id)")

    # ── Tax ─────────────────────────────────────────────────────────────────
    x("""CREATE TABLE IF NOT EXISTS fin_tax_code (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
        code VARCHAR(20) NOT NULL,
        name VARCHAR(100) NOT NULL,
        tax_type VARCHAR(20) NOT NULL,
        rate NUMERIC(8,4) NOT NULL,
        gl_account_id UUID REFERENCES fin_account(id) ON DELETE SET NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT now()
    )""")
    x("CREATE INDEX IF NOT EXISTS ix_fin_tc_vendor ON fin_tax_code(vendor_id)")

    x("""CREATE TABLE IF NOT EXISTS fin_tax_return (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
        return_type VARCHAR(20) NOT NULL,
        period_start DATE NOT NULL,
        period_end DATE NOT NULL,
        status VARCHAR(20) DEFAULT 'draft',
        computed_json JSONB,
        total_tax_liability NUMERIC(18,4) DEFAULT 0,
        total_itc NUMERIC(18,4) DEFAULT 0,
        net_payable NUMERIC(18,4) DEFAULT 0,
        filing_reference VARCHAR(100),
        filed_at TIMESTAMPTZ,
        filed_by_id UUID REFERENCES vendor_user(id) ON DELETE SET NULL,
        due_date DATE,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
    )""")
    x("CREATE INDEX IF NOT EXISTS ix_fin_tr_vendor ON fin_tax_return(vendor_id)")

    # ── Fixed Assets ─────────────────────────────────────────────────────────
    x("""CREATE TABLE IF NOT EXISTS fin_asset_category (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        depreciation_method VARCHAR(20) DEFAULT 'straight_line',
        useful_life_years INTEGER DEFAULT 5,
        salvage_pct NUMERIC(6,4) DEFAULT 0,
        asset_account_id UUID REFERENCES fin_account(id) ON DELETE SET NULL,
        accum_dep_account_id UUID REFERENCES fin_account(id) ON DELETE SET NULL,
        dep_expense_account_id UUID REFERENCES fin_account(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT now()
    )""")
    x("CREATE INDEX IF NOT EXISTS ix_fin_ac_vendor ON fin_asset_category(vendor_id)")

    x("""CREATE TABLE IF NOT EXISTS fin_asset (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
        category_id UUID REFERENCES fin_asset_category(id) ON DELETE RESTRICT,
        asset_code VARCHAR(30) NOT NULL,
        name VARCHAR(200) NOT NULL,
        description TEXT,
        acquisition_date DATE NOT NULL,
        purchase_cost NUMERIC(18,4) NOT NULL,
        salvage_value NUMERIC(18,4) DEFAULT 0,
        useful_life_years INTEGER,
        depreciation_method VARCHAR(20),
        current_value NUMERIC(18,4),
        accumulated_depreciation NUMERIC(18,4) DEFAULT 0,
        location VARCHAR(200),
        store_id UUID REFERENCES store(id) ON DELETE SET NULL,
        serial_number VARCHAR(100),
        status VARCHAR(20) DEFAULT 'active',
        disposal_date DATE,
        disposal_value NUMERIC(18,4),
        notes TEXT,
        vendor_bill_id UUID REFERENCES fin_vendor_bill(id) ON DELETE SET NULL,
        journal_entry_id UUID REFERENCES fin_journal_entry(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
    )""")
    x("CREATE INDEX IF NOT EXISTS ix_fin_asset_vendor ON fin_asset(vendor_id)")

    x("""CREATE TABLE IF NOT EXISTS fin_asset_depreciation_entry (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        asset_id UUID NOT NULL REFERENCES fin_asset(id) ON DELETE CASCADE,
        vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
        period_id UUID REFERENCES fin_period(id) ON DELETE SET NULL,
        depreciation_date DATE NOT NULL,
        amount NUMERIC(18,4) NOT NULL,
        book_value_after NUMERIC(18,4),
        journal_entry_id UUID REFERENCES fin_journal_entry(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT now()
    )""")
    x("CREATE INDEX IF NOT EXISTS ix_fin_ade_asset ON fin_asset_depreciation_entry(asset_id)")
    x("CREATE INDEX IF NOT EXISTS ix_fin_ade_vendor ON fin_asset_depreciation_entry(vendor_id)")

    x("""CREATE TABLE IF NOT EXISTS fin_asset_disposal (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        asset_id UUID NOT NULL REFERENCES fin_asset(id) ON DELETE CASCADE,
        vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
        disposal_date DATE NOT NULL,
        disposal_method VARCHAR(30),
        sale_price NUMERIC(18,4) DEFAULT 0,
        book_value_at_disposal NUMERIC(18,4),
        gain_loss NUMERIC(18,4) DEFAULT 0,
        journal_entry_id UUID REFERENCES fin_journal_entry(id) ON DELETE SET NULL,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT now()
    )""")
    x("CREATE INDEX IF NOT EXISTS ix_fin_ad_asset ON fin_asset_disposal(asset_id)")

    x("""CREATE TABLE IF NOT EXISTS fin_asset_maintenance (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        asset_id UUID NOT NULL REFERENCES fin_asset(id) ON DELETE CASCADE,
        vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
        maintenance_date DATE NOT NULL,
        description TEXT,
        cost NUMERIC(18,4) DEFAULT 0,
        vendor_name VARCHAR(200),
        status VARCHAR(20) DEFAULT 'scheduled',
        journal_entry_id UUID REFERENCES fin_journal_entry(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT now()
    )""")
    x("CREATE INDEX IF NOT EXISTS ix_fin_am_asset ON fin_asset_maintenance(asset_id)")

    # ── Capital: Loans & Investments ─────────────────────────────────────────
    x("""CREATE TABLE IF NOT EXISTS fin_loan (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
        name VARCHAR(200) NOT NULL,
        lender_name VARCHAR(200),
        loan_type VARCHAR(30) DEFAULT 'term',
        principal NUMERIC(18,4) NOT NULL,
        outstanding_balance NUMERIC(18,4),
        interest_rate NUMERIC(8,4),
        rate_type VARCHAR(10) DEFAULT 'fixed',
        disbursement_date DATE,
        maturity_date DATE,
        tenure_months INTEGER,
        emi_amount NUMERIC(18,4),
        payment_frequency VARCHAR(20) DEFAULT 'monthly',
        gl_account_id UUID REFERENCES fin_account(id) ON DELETE SET NULL,
        status VARCHAR(20) DEFAULT 'active',
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT now()
    )""")
    x("CREATE INDEX IF NOT EXISTS ix_fin_loan_vendor ON fin_loan(vendor_id)")

    x("""CREATE TABLE IF NOT EXISTS fin_loan_schedule_line (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        loan_id UUID NOT NULL REFERENCES fin_loan(id) ON DELETE CASCADE,
        installment_no INTEGER NOT NULL,
        due_date DATE NOT NULL,
        principal_amount NUMERIC(18,4) DEFAULT 0,
        interest_amount NUMERIC(18,4) DEFAULT 0,
        total_emi NUMERIC(18,4) DEFAULT 0,
        outstanding_after NUMERIC(18,4) DEFAULT 0,
        paid_date DATE,
        paid_amount NUMERIC(18,4) DEFAULT 0,
        status VARCHAR(20) DEFAULT 'pending',
        journal_entry_id UUID REFERENCES fin_journal_entry(id) ON DELETE SET NULL
    )""")
    x("CREATE INDEX IF NOT EXISTS ix_fin_lsl_loan ON fin_loan_schedule_line(loan_id)")

    x("""CREATE TABLE IF NOT EXISTS fin_investment (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
        name VARCHAR(200) NOT NULL,
        investment_type VARCHAR(30) DEFAULT 'fd',
        invested_amount NUMERIC(18,4) NOT NULL,
        investment_date DATE NOT NULL,
        expected_return_pct NUMERIC(8,4),
        maturity_date DATE,
        current_value NUMERIC(18,4),
        realized_gain_loss NUMERIC(18,4) DEFAULT 0,
        status VARCHAR(20) DEFAULT 'active',
        notes TEXT,
        gl_account_id UUID REFERENCES fin_account(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT now()
    )""")
    x("CREATE INDEX IF NOT EXISTS ix_fin_inv_vendor ON fin_investment(vendor_id)")

    x("""CREATE TABLE IF NOT EXISTS fin_investment_valuation (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        investment_id UUID NOT NULL REFERENCES fin_investment(id) ON DELETE CASCADE,
        valuation_date DATE NOT NULL,
        market_value NUMERIC(18,4) NOT NULL,
        unrealized_gain_loss NUMERIC(18,4) DEFAULT 0,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT now()
    )""")
    x("CREATE INDEX IF NOT EXISTS ix_fin_iv_investment ON fin_investment_valuation(investment_id)")

    # ── Controls & Audit ────────────────────────────────────────────────────
    x("""CREATE TABLE IF NOT EXISTS fin_approval_policy (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
        name VARCHAR(200) NOT NULL DEFAULT 'Default Policy',
        entity_type VARCHAR(40) NOT NULL,
        threshold_amount NUMERIC(18,4),
        approver_user_id UUID REFERENCES vendor_user(id) ON DELETE SET NULL,
        approver_role_slug VARCHAR(50),
        levels INTEGER DEFAULT 1,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT now()
    )""")
    x("CREATE INDEX IF NOT EXISTS ix_fin_ap_vendor ON fin_approval_policy(vendor_id)")

    x("""CREATE TABLE IF NOT EXISTS fin_approval_request (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
        policy_id UUID REFERENCES fin_approval_policy(id) ON DELETE SET NULL,
        entity_type VARCHAR(40) NOT NULL,
        entity_id UUID NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        amount NUMERIC(18,4),
        requested_by_id UUID REFERENCES vendor_user(id) ON DELETE SET NULL,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT now(),
        resolved_at TIMESTAMPTZ
    )""")
    x("CREATE INDEX IF NOT EXISTS ix_fin_ar_vendor ON fin_approval_request(vendor_id)")
    x("CREATE INDEX IF NOT EXISTS ix_fin_ar_entity ON fin_approval_request(entity_id)")

    x("""CREATE TABLE IF NOT EXISTS fin_approval_step (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        request_id UUID NOT NULL REFERENCES fin_approval_request(id) ON DELETE CASCADE,
        step_number INTEGER DEFAULT 1,
        approver_id UUID REFERENCES vendor_user(id) ON DELETE SET NULL,
        status VARCHAR(20) DEFAULT 'pending',
        action_at TIMESTAMPTZ,
        comments TEXT
    )""")
    x("CREATE INDEX IF NOT EXISTS ix_fin_as_request ON fin_approval_step(request_id)")

    x("""CREATE TABLE IF NOT EXISTS fin_audit_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
        entity_type VARCHAR(40) NOT NULL,
        entity_id UUID NOT NULL,
        action VARCHAR(30) NOT NULL,
        description TEXT,
        diff_json JSONB,
        performed_by_id UUID REFERENCES vendor_user(id) ON DELETE SET NULL,
        ip_address VARCHAR(45),
        user_agent VARCHAR(500),
        created_at TIMESTAMPTZ DEFAULT now()
    )""")
    x("CREATE INDEX IF NOT EXISTS ix_fin_al_vendor ON fin_audit_log(vendor_id)")
    x("CREATE INDEX IF NOT EXISTS ix_fin_al_entity ON fin_audit_log(entity_type, entity_id)")
    x("CREATE INDEX IF NOT EXISTS ix_fin_al_created ON fin_audit_log(created_at)")


def downgrade() -> None:
    tables = [
        "fin_audit_log", "fin_approval_step", "fin_approval_request", "fin_approval_policy",
        "fin_investment_valuation", "fin_investment",
        "fin_loan_schedule_line", "fin_loan",
        "fin_asset_maintenance", "fin_asset_disposal", "fin_asset_depreciation_entry",
        "fin_asset", "fin_asset_category",
        "fin_tax_return", "fin_tax_code",
        "fin_forecast_line", "fin_forecast",
        "fin_budget_line", "fin_budget",
        "fin_reconciliation_match", "fin_bank_statement_line",
        "fin_bank_reconciliation", "fin_bank_statement",
        "fin_ap_aging_snapshot", "fin_payment_run_item", "fin_vendor_payment",
        "fin_payment_run", "fin_vendor_bill_line", "fin_vendor_bill",
        "fin_bank_account",
        "fin_ar_aging_snapshot", "fin_customer_payment_application",
        "fin_journal_line", "fin_journal_entry", "fin_recurring_template",
        "fin_exchange_rate", "fin_period", "fin_fiscal_year", "fin_account",
    ]
    for t in tables:
        op.execute(f"DROP TABLE IF EXISTS {t} CASCADE")
