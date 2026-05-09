"""Controlling (CO) core: activity types, overhead pools, product cost versions,
manufacturing / project orders, order cost lines.

Revision ID: co001_controlling_core
Revises: fin008_audit_month_split

If your DB uses a different Alembic head, change down_revision or merge branches first.
"""
from alembic import op


revision = "co001_controlling_core"
down_revision = "fin008_audit_month_split"
branch_labels = None
depends_on = None


def x(sql: str) -> None:
    op.execute(sql.strip())


def upgrade() -> None:
    x("""CREATE TABLE IF NOT EXISTS co_activity_type (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
        company_id UUID NOT NULL REFERENCES fin_company(id) ON DELETE CASCADE,
        code VARCHAR(30) NOT NULL,
        name VARCHAR(200) NOT NULL,
        description TEXT,
        uom VARCHAR(20) DEFAULT 'H',
        default_cost_center_id UUID REFERENCES fin_cost_center(id) ON DELETE SET NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT now(),
        CONSTRAINT uq_co_act_vendor_company_code UNIQUE (vendor_id, company_id, code)
    )""")
    x("CREATE INDEX IF NOT EXISTS ix_co_act_vendor ON co_activity_type(vendor_id)")

    x("""CREATE TABLE IF NOT EXISTS co_overhead_pool (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
        company_id UUID NOT NULL REFERENCES fin_company(id) ON DELETE CASCADE,
        code VARCHAR(30) NOT NULL,
        name VARCHAR(200) NOT NULL,
        description TEXT,
        allocation_base VARCHAR(40) NOT NULL DEFAULT 'labor_hours',
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT now(),
        CONSTRAINT uq_co_oh_pool_vendor_company_code UNIQUE (vendor_id, company_id, code)
    )""")

    x("""CREATE TABLE IF NOT EXISTS co_overhead_rate (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        pool_id UUID NOT NULL REFERENCES co_overhead_pool(id) ON DELETE CASCADE,
        effective_from DATE NOT NULL,
        effective_to DATE,
        rate_per_unit NUMERIC(18,6) NOT NULL DEFAULT 0,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT now()
    )""")
    x("CREATE INDEX IF NOT EXISTS ix_co_oh_rate_pool_from ON co_overhead_rate(pool_id, effective_from)")

    x("""CREATE TABLE IF NOT EXISTS co_product_cost_version (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
        company_id UUID NOT NULL REFERENCES fin_company(id) ON DELETE CASCADE,
        product_id UUID NOT NULL REFERENCES product(id) ON DELETE CASCADE,
        version_code VARCHAR(40) NOT NULL,
        valid_from DATE NOT NULL,
        valid_to DATE,
        status VARCHAR(20) DEFAULT 'draft',
        material_total_planned NUMERIC(18,4) DEFAULT 0,
        activity_total_planned NUMERIC(18,4) DEFAULT 0,
        overhead_total_planned NUMERIC(18,4) DEFAULT 0,
        rolled_up_unit_cost NUMERIC(18,6) DEFAULT 0,
        notes TEXT,
        extra JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now(),
        CONSTRAINT uq_co_pcv_version UNIQUE (vendor_id, company_id, product_id, version_code)
    )""")
    x("CREATE INDEX IF NOT EXISTS ix_co_pcv_product_status ON co_product_cost_version(vendor_id, product_id, status)")

    x("""CREATE TABLE IF NOT EXISTS co_product_cost_line (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        version_id UUID NOT NULL REFERENCES co_product_cost_version(id) ON DELETE CASCADE,
        line_type VARCHAR(20) NOT NULL,
        description VARCHAR(500),
        component_product_id UUID REFERENCES product(id) ON DELETE SET NULL,
        activity_type_id UUID REFERENCES co_activity_type(id) ON DELETE SET NULL,
        overhead_pool_id UUID REFERENCES co_overhead_pool(id) ON DELETE SET NULL,
        qty_per_output_unit NUMERIC(18,6) DEFAULT 0,
        unit_rate_planned NUMERIC(18,6) DEFAULT 0,
        amount_planned NUMERIC(18,4) DEFAULT 0,
        sequence INTEGER DEFAULT 0
    )""")
    x("CREATE INDEX IF NOT EXISTS ix_co_pcl_version ON co_product_cost_line(version_id)")

    x("""CREATE TABLE IF NOT EXISTS co_manufacturing_order (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
        company_id UUID NOT NULL REFERENCES fin_company(id) ON DELETE CASCADE,
        order_no VARCHAR(40) NOT NULL,
        order_kind VARCHAR(20) NOT NULL DEFAULT 'assembly',
        status VARCHAR(20) NOT NULL DEFAULT 'draft',
        product_id UUID REFERENCES product(id) ON DELETE SET NULL,
        qty_planned NUMERIC(18,4) DEFAULT 0,
        qty_delivered NUMERIC(18,4) DEFAULT 0,
        cost_center_id UUID REFERENCES fin_cost_center(id) ON DELETE SET NULL,
        project_id UUID REFERENCES fin_project(id) ON DELETE SET NULL,
        scheduled_start DATE,
        scheduled_end DATE,
        released_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ,
        notes TEXT,
        extra JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now(),
        CONSTRAINT uq_co_mo_vendor_order_no UNIQUE (vendor_id, order_no)
    )""")
    x("CREATE INDEX IF NOT EXISTS ix_co_mo_vendor_status ON co_manufacturing_order(vendor_id, status)")
    x("CREATE INDEX IF NOT EXISTS ix_co_mo_project ON co_manufacturing_order(project_id)")

    x("""CREATE TABLE IF NOT EXISTS co_order_cost_line (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id UUID NOT NULL REFERENCES co_manufacturing_order(id) ON DELETE CASCADE,
        category VARCHAR(20) NOT NULL,
        description VARCHAR(500),
        product_id UUID REFERENCES product(id) ON DELETE SET NULL,
        activity_type_id UUID REFERENCES co_activity_type(id) ON DELETE SET NULL,
        overhead_pool_id UUID REFERENCES co_overhead_pool(id) ON DELETE SET NULL,
        uom VARCHAR(20) DEFAULT 'EA',
        qty_planned NUMERIC(18,6) DEFAULT 0,
        qty_actual NUMERIC(18,6) DEFAULT 0,
        rate_planned NUMERIC(18,6) DEFAULT 0,
        rate_actual NUMERIC(18,6) DEFAULT 0,
        amount_planned NUMERIC(18,4) DEFAULT 0,
        amount_actual NUMERIC(18,4) DEFAULT 0,
        sequence INTEGER DEFAULT 0
    )""")
    x("CREATE INDEX IF NOT EXISTS ix_co_ocl_order ON co_order_cost_line(order_id)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS co_order_cost_line CASCADE")
    op.execute("DROP TABLE IF EXISTS co_manufacturing_order CASCADE")
    op.execute("DROP TABLE IF EXISTS co_product_cost_line CASCADE")
    op.execute("DROP TABLE IF EXISTS co_product_cost_version CASCADE")
    op.execute("DROP TABLE IF EXISTS co_overhead_rate CASCADE")
    op.execute("DROP TABLE IF EXISTS co_overhead_pool CASCADE")
    op.execute("DROP TABLE IF EXISTS co_activity_type CASCADE")
