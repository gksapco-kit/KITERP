"""Sales Commission Module — core tables.

Creates:
  - commission_payee
  - commission_plan
  - commission_rule
  - commission_assignment
  - commission_payout_run
  - commission_payout_item
  - commission_accrual
  - commission_approval_log

Revision ID: comm001_commission_core
Revises: fin002_store_company_code
Create Date: 2026-04-22
"""

revision = "comm001_commission_core"
down_revision = "fin002_store_company_code"
branch_labels = None
depends_on = None

from alembic import op


def x(sql: str) -> None:
    op.execute(sql.strip())


def upgrade() -> None:
    # ── commission_payee ─────────────────────────────────────────
    x("""
        CREATE TABLE IF NOT EXISTS commission_payee (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            vendor_id       UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
            code            VARCHAR(30),
            display_name    VARCHAR(200) NOT NULL,
            phone           VARCHAR(30),
            email           VARCHAR(255),
            external_user_id VARCHAR(100),
            link_type       VARCHAR(30) NOT NULL DEFAULT 'external',
            vendor_user_id  UUID REFERENCES vendor_user(id) ON DELETE SET NULL,
            supplier_id     UUID REFERENCES supplier(id) ON DELETE SET NULL,
            customer_id     UUID REFERENCES customer(id) ON DELETE SET NULL,
            default_payout_method VARCHAR(30) DEFAULT 'bank_transfer',
            bank_account_id UUID,
            currency        VARCHAR(3) DEFAULT 'INR',
            status          VARCHAR(20) DEFAULT 'active',
            settings        JSONB DEFAULT '{}',
            created_at      TIMESTAMPTZ DEFAULT NOW(),
            updated_at      TIMESTAMPTZ
        )
    """)
    x("CREATE INDEX IF NOT EXISTS idx_comm_payee_vendor ON commission_payee(vendor_id)")
    x("CREATE INDEX IF NOT EXISTS idx_comm_payee_vendor_phone ON commission_payee(vendor_id, phone)")
    x("CREATE INDEX IF NOT EXISTS idx_comm_payee_vendor_ext_id ON commission_payee(vendor_id, external_user_id)")
    x("CREATE INDEX IF NOT EXISTS idx_comm_payee_vendor_code ON commission_payee(vendor_id, code)")

    # ── commission_plan ──────────────────────────────────────────
    x("""
        CREATE TABLE IF NOT EXISTS commission_plan (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            vendor_id       UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
            code            VARCHAR(30) NOT NULL,
            name            VARCHAR(200) NOT NULL,
            description     TEXT,
            status          VARCHAR(20) DEFAULT 'active',
            effective_from  DATE,
            effective_to    DATE,
            payee_scope     VARCHAR(30) DEFAULT 'any',
            priority        INTEGER DEFAULT 10,
            stackable       BOOLEAN DEFAULT FALSE,
            settings        JSONB DEFAULT '{}',
            created_at      TIMESTAMPTZ DEFAULT NOW(),
            updated_at      TIMESTAMPTZ,
            CONSTRAINT uq_comm_plan_vendor_code UNIQUE (vendor_id, code)
        )
    """)
    x("CREATE INDEX IF NOT EXISTS idx_comm_plan_vendor ON commission_plan(vendor_id)")
    x("CREATE INDEX IF NOT EXISTS idx_comm_plan_vendor_status ON commission_plan(vendor_id, status)")

    # ── commission_rule ──────────────────────────────────────────
    x("""
        CREATE TABLE IF NOT EXISTS commission_rule (
            id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            plan_id             UUID NOT NULL REFERENCES commission_plan(id) ON DELETE CASCADE,
            vendor_id           UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
            name                VARCHAR(200),
            priority            INTEGER DEFAULT 10,
            is_active           BOOLEAN DEFAULT TRUE,
            applies_to          VARCHAR(20) DEFAULT 'all',
            product_id          UUID,
            service_id          UUID,
            category_id         UUID,
            uom                 VARCHAR(30),
            store_id            UUID,
            customer_group      VARCHAR(100),
            channel             VARCHAR(20) DEFAULT 'any',
            event_tag           VARCHAR(100),
            team_id             UUID,
            min_qty             NUMERIC(12,4),
            min_amount          NUMERIC(12,2),
            window_type         VARCHAR(20) DEFAULT 'per_line',
            period              VARCHAR(20),
            revenue_threshold   NUMERIC(12,2),
            count_threshold     INTEGER,
            calculation_type    VARCHAR(30) NOT NULL DEFAULT 'percentage',
            value_numeric       NUMERIC(12,4),
            value_currency      NUMERIC(12,2),
            points_per_unit     NUMERIC(12,4),
            equity_units        NUMERIC(18,6),
            tier_table          JSONB,
            time_rate           JSONB,
            cap_amount          NUMERIC(12,2),
            floor_amount        NUMERIC(12,2),
            payee_share_percent NUMERIC(5,2),
            created_at          TIMESTAMPTZ DEFAULT NOW(),
            updated_at          TIMESTAMPTZ
        )
    """)
    x("CREATE INDEX IF NOT EXISTS idx_comm_rule_plan ON commission_rule(plan_id)")
    x("CREATE INDEX IF NOT EXISTS idx_comm_rule_vendor ON commission_rule(vendor_id)")

    # ── commission_assignment ────────────────────────────────────
    x("""
        CREATE TABLE IF NOT EXISTS commission_assignment (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            vendor_id       UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
            plan_id         UUID NOT NULL REFERENCES commission_plan(id) ON DELETE CASCADE,
            payee_id        UUID NOT NULL REFERENCES commission_payee(id) ON DELETE CASCADE,
            store_id        UUID,
            team_id         UUID,
            location        VARCHAR(200),
            group_name      VARCHAR(100),
            valid_from      DATE,
            valid_to        DATE,
            weight_percent  NUMERIC(5,2) DEFAULT 100,
            is_active       BOOLEAN DEFAULT TRUE,
            notes           TEXT,
            created_at      TIMESTAMPTZ DEFAULT NOW(),
            updated_at      TIMESTAMPTZ
        )
    """)
    x("CREATE INDEX IF NOT EXISTS idx_comm_assign_vendor ON commission_assignment(vendor_id)")
    x("CREATE INDEX IF NOT EXISTS idx_comm_assign_vendor_payee ON commission_assignment(vendor_id, payee_id)")
    x("CREATE INDEX IF NOT EXISTS idx_comm_assign_vendor_plan ON commission_assignment(vendor_id, plan_id)")

    # ── commission_payout_run ────────────────────────────────────
    x("""
        CREATE TABLE IF NOT EXISTS commission_payout_run (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            vendor_id       UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
            run_no          VARCHAR(30) NOT NULL,
            period_start    DATE,
            period_end      DATE,
            status          VARCHAR(20) NOT NULL DEFAULT 'open',
            total_amount    NUMERIC(12,2) DEFAULT 0,
            total_points    NUMERIC(12,4) DEFAULT 0,
            payee_count     INTEGER DEFAULT 0,
            payment_method  VARCHAR(30),
            gl_entry_id     UUID,
            notes           TEXT,
            created_by_id   UUID,
            approved_by_id  UUID,
            approved_at     TIMESTAMPTZ,
            paid_at         TIMESTAMPTZ,
            created_at      TIMESTAMPTZ DEFAULT NOW(),
            updated_at      TIMESTAMPTZ,
            CONSTRAINT uq_comm_payout_run_no UNIQUE (vendor_id, run_no)
        )
    """)
    x("CREATE INDEX IF NOT EXISTS idx_comm_payout_run_vendor ON commission_payout_run(vendor_id)")
    x("CREATE INDEX IF NOT EXISTS idx_comm_payout_run_vendor_status ON commission_payout_run(vendor_id, status)")

    # ── commission_payout_item ───────────────────────────────────
    x("""
        CREATE TABLE IF NOT EXISTS commission_payout_item (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            run_id          UUID NOT NULL REFERENCES commission_payout_run(id) ON DELETE CASCADE,
            payee_id        UUID NOT NULL REFERENCES commission_payee(id) ON DELETE RESTRICT,
            total_amount    NUMERIC(12,2) DEFAULT 0,
            total_points    NUMERIC(12,4) DEFAULT 0,
            total_equity    NUMERIC(18,6) DEFAULT 0,
            accrual_count   INTEGER DEFAULT 0,
            status          VARCHAR(20) DEFAULT 'pending',
            payment_ref     VARCHAR(200),
            paid_at         TIMESTAMPTZ,
            created_at      TIMESTAMPTZ DEFAULT NOW()
        )
    """)
    x("CREATE INDEX IF NOT EXISTS idx_comm_payout_item_run ON commission_payout_item(run_id)")
    x("CREATE INDEX IF NOT EXISTS idx_comm_payout_item_payee ON commission_payout_item(payee_id)")

    # ── commission_accrual ───────────────────────────────────────
    x("""
        CREATE TABLE IF NOT EXISTS commission_accrual (
            id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            vendor_id           UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
            payee_id            UUID NOT NULL REFERENCES commission_payee(id) ON DELETE RESTRICT,
            plan_id             UUID REFERENCES commission_plan(id) ON DELETE SET NULL,
            rule_id             UUID REFERENCES commission_rule(id) ON DELETE SET NULL,
            assignment_id       UUID REFERENCES commission_assignment(id) ON DELETE SET NULL,
            source_type         VARCHAR(20) NOT NULL,
            source_id           UUID NOT NULL,
            source_line_ref     VARCHAR(100),
            sale_date           DATE NOT NULL,
            store_id            UUID,
            channel             VARCHAR(20),
            base_amount         NUMERIC(12,2) NOT NULL DEFAULT 0,
            calculation_type    VARCHAR(30) NOT NULL,
            value_applied       NUMERIC(12,4),
            commission_amount   NUMERIC(12,2) NOT NULL DEFAULT 0,
            points_amount       NUMERIC(12,4) DEFAULT 0,
            equity_units_amount NUMERIC(18,6) DEFAULT 0,
            currency            VARCHAR(3) DEFAULT 'INR',
            status              VARCHAR(20) NOT NULL DEFAULT 'accrued',
            payout_item_id      UUID REFERENCES commission_payout_item(id) ON DELETE SET NULL,
            gl_entry_id         UUID,
            reversal_of         UUID REFERENCES commission_accrual(id) ON DELETE SET NULL,
            created_by_id       UUID,
            approved_by_id      UUID,
            approved_at         TIMESTAMPTZ,
            notes               TEXT,
            created_at          TIMESTAMPTZ DEFAULT NOW(),
            updated_at          TIMESTAMPTZ,
            CONSTRAINT uq_comm_accrual_idempotent UNIQUE (
                vendor_id, source_type, source_id, source_line_ref, payee_id, rule_id
            )
        )
    """)
    x("CREATE INDEX IF NOT EXISTS idx_comm_accrual_vendor ON commission_accrual(vendor_id)")
    x("CREATE INDEX IF NOT EXISTS idx_comm_accrual_vendor_status ON commission_accrual(vendor_id, status)")
    x("CREATE INDEX IF NOT EXISTS idx_comm_accrual_source ON commission_accrual(source_type, source_id)")
    x("CREATE INDEX IF NOT EXISTS idx_comm_accrual_sale_date ON commission_accrual(vendor_id, sale_date)")
    x("CREATE INDEX IF NOT EXISTS idx_comm_accrual_payee ON commission_accrual(payee_id)")

    # ── commission_approval_log ──────────────────────────────────
    x("""
        CREATE TABLE IF NOT EXISTS commission_approval_log (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            vendor_id       UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
            entity_type     VARCHAR(50) NOT NULL,
            entity_id       UUID NOT NULL,
            action          VARCHAR(50) NOT NULL,
            actor_id        UUID,
            notes           TEXT,
            ts              TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)
    x("CREATE INDEX IF NOT EXISTS idx_comm_approval_log_vendor ON commission_approval_log(vendor_id)")
    x("CREATE INDEX IF NOT EXISTS idx_comm_approval_log_entity ON commission_approval_log(entity_type, entity_id)")


def downgrade() -> None:
    x("DROP TABLE IF EXISTS commission_approval_log CASCADE")
    x("DROP TABLE IF EXISTS commission_accrual CASCADE")
    x("DROP TABLE IF EXISTS commission_payout_item CASCADE")
    x("DROP TABLE IF EXISTS commission_payout_run CASCADE")
    x("DROP TABLE IF EXISTS commission_assignment CASCADE")
    x("DROP TABLE IF EXISTS commission_rule CASCADE")
    x("DROP TABLE IF EXISTS commission_plan CASCADE")
    x("DROP TABLE IF EXISTS commission_payee CASCADE")
