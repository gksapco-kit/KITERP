"""Pharma manufacturing schema + merge concurrent heads.

Revision ID: pharma001_pharma_schema
Revises: inv005_storage_loc_plant_nullable, memo001_pos_txn_session_nullable, order001_payment_proof, pwa001
Create Date: 2026-07-25

Idempotent CREATE/ALTER matching ensure_pharma_schema() so prod can rely on
alembic upgrade as well as startup DDL.
"""
from alembic import op

revision = "pharma001_pharma_schema"
down_revision = (
    "inv005_storage_loc_plant_nullable",
    "memo001_pos_txn_session_nullable",
    "order001_payment_proof",
    "pwa001",
)
branch_labels = None
depends_on = None


def upgrade() -> None:
    stmts = [
        "ALTER TABLE product ADD COLUMN IF NOT EXISTS batch_managed BOOLEAN NOT NULL DEFAULT FALSE",
        "ALTER TABLE product ADD COLUMN IF NOT EXISTS serial_managed BOOLEAN NOT NULL DEFAULT FALSE",
        "ALTER TABLE product ADD COLUMN IF NOT EXISTS shelf_life_days INTEGER",
        "ALTER TABLE product ADD COLUMN IF NOT EXISTS retest_days INTEGER",
        "ALTER TABLE product ADD COLUMN IF NOT EXISTS qc_required_on_receipt BOOLEAN NOT NULL DEFAULT FALSE",
        "ALTER TABLE product ADD COLUMN IF NOT EXISTS qc_required_on_production BOOLEAN NOT NULL DEFAULT FALSE",
        "CREATE INDEX IF NOT EXISTS idx_product_batch_managed ON product (vendor_id, batch_managed)",
        "ALTER TABLE storage_location ADD COLUMN IF NOT EXISTS stock_type VARCHAR(30) NOT NULL DEFAULT 'unrestricted'",
        "CREATE INDEX IF NOT EXISTS idx_storage_location_stock_type ON storage_location (vendor_id, stock_type)",
        """CREATE TABLE IF NOT EXISTS pharma_batch_sequence (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
            plant_id UUID REFERENCES plant(id) ON DELETE CASCADE,
            product_id UUID REFERENCES product(id) ON DELETE CASCADE,
            prefix VARCHAR(40) NOT NULL DEFAULT 'B',
            last_number INTEGER NOT NULL DEFAULT 0,
            pad_width INTEGER NOT NULL DEFAULT 5,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now()
        )""",
        "CREATE INDEX IF NOT EXISTS ix_pharma_batch_seq_vendor ON pharma_batch_sequence (vendor_id)",
        """CREATE TABLE IF NOT EXISTS batch_transaction (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
            txn_type VARCHAR(30) NOT NULL,
            source_type VARCHAR(30),
            source_id UUID,
            document_number VARCHAR(60),
            product_id UUID NOT NULL REFERENCES product(id) ON DELETE CASCADE,
            variant_id UUID REFERENCES product_variant(id) ON DELETE SET NULL,
            from_batch_id UUID REFERENCES goods_batch(id) ON DELETE SET NULL,
            to_batch_id UUID REFERENCES goods_batch(id) ON DELETE SET NULL,
            quantity NUMERIC(14,4) NOT NULL,
            uom VARCHAR(30),
            plant_id UUID REFERENCES plant(id) ON DELETE SET NULL,
            from_storage_location_id UUID REFERENCES storage_location(id) ON DELETE SET NULL,
            to_storage_location_id UUID REFERENCES storage_location(id) ON DELETE SET NULL,
            quality_status VARCHAR(30),
            notes TEXT,
            meta JSONB NOT NULL DEFAULT '{}'::jsonb,
            performed_by UUID REFERENCES vendor_user(id) ON DELETE SET NULL,
            created_at TIMESTAMPTZ DEFAULT now()
        )""",
        "CREATE INDEX IF NOT EXISTS ix_batch_txn_vendor ON batch_transaction (vendor_id)",
        """CREATE TABLE IF NOT EXISTS pharma_mbr (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
            product_id UUID NOT NULL REFERENCES product(id) ON DELETE CASCADE,
            code VARCHAR(60) NOT NULL,
            title VARCHAR(255) NOT NULL,
            version INTEGER NOT NULL DEFAULT 1,
            status VARCHAR(30) NOT NULL DEFAULT 'draft',
            batch_size NUMERIC(14,4),
            batch_size_uom VARCHAR(30),
            bom_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
            operations JSONB NOT NULL DEFAULT '[]'::jsonb,
            line_clearance JSONB NOT NULL DEFAULT '[]'::jsonb,
            ipc_checks JSONB NOT NULL DEFAULT '[]'::jsonb,
            notes TEXT,
            approved_at TIMESTAMPTZ,
            approved_by UUID REFERENCES vendor_user(id) ON DELETE SET NULL,
            effective_from DATE,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now()
        )""",
        """CREATE TABLE IF NOT EXISTS pharma_bpr (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
            mbr_id UUID REFERENCES pharma_mbr(id) ON DELETE SET NULL,
            production_order_id UUID REFERENCES production_order(id) ON DELETE SET NULL,
            goods_batch_id UUID REFERENCES goods_batch(id) ON DELETE SET NULL,
            product_id UUID NOT NULL REFERENCES product(id) ON DELETE CASCADE,
            batch_number VARCHAR(80) NOT NULL,
            status VARCHAR(30) NOT NULL DEFAULT 'open',
            planned_qty NUMERIC(14,4),
            actual_qty NUMERIC(14,4),
            yield_pct NUMERIC(8,2),
            operation_log JSONB NOT NULL DEFAULT '[]'::jsonb,
            material_log JSONB NOT NULL DEFAULT '[]'::jsonb,
            ipc_results JSONB NOT NULL DEFAULT '[]'::jsonb,
            clearance_done BOOLEAN DEFAULT FALSE,
            notes TEXT,
            pdf_url VARCHAR(500),
            started_at TIMESTAMPTZ,
            completed_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now()
        )""",
        "ALTER TABLE pharma_bpr ADD COLUMN IF NOT EXISTS pdf_url VARCHAR(500)",
        """CREATE TABLE IF NOT EXISTS pharma_qc_spec (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
            product_id UUID NOT NULL REFERENCES product(id) ON DELETE CASCADE,
            code VARCHAR(60) NOT NULL,
            title VARCHAR(255) NOT NULL,
            version INTEGER NOT NULL DEFAULT 1,
            status VARCHAR(30) NOT NULL DEFAULT 'draft',
            items JSONB NOT NULL DEFAULT '[]'::jsonb,
            notes TEXT,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now()
        )""",
        """CREATE TABLE IF NOT EXISTS pharma_inspection_lot (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
            goods_batch_id UUID NOT NULL REFERENCES goods_batch(id) ON DELETE CASCADE,
            product_id UUID NOT NULL REFERENCES product(id) ON DELETE CASCADE,
            qc_spec_id UUID REFERENCES pharma_qc_spec(id) ON DELETE SET NULL,
            origin VARCHAR(30) NOT NULL DEFAULT 'receipt',
            status VARCHAR(30) NOT NULL DEFAULT 'open',
            sample_qty NUMERIC(14,4),
            results JSONB NOT NULL DEFAULT '[]'::jsonb,
            decision VARCHAR(30),
            decision_notes TEXT,
            decided_by UUID REFERENCES vendor_user(id) ON DELETE SET NULL,
            decided_at TIMESTAMPTZ,
            coa_number VARCHAR(60),
            coa_data JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now()
        )""",
        """CREATE TABLE IF NOT EXISTS pharma_recall (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
            goods_batch_id UUID NOT NULL REFERENCES goods_batch(id) ON DELETE CASCADE,
            recall_number VARCHAR(60) NOT NULL,
            reason TEXT NOT NULL,
            severity VARCHAR(20) NOT NULL DEFAULT 'class_ii',
            status VARCHAR(30) NOT NULL DEFAULT 'open',
            affected_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
            actions JSONB NOT NULL DEFAULT '[]'::jsonb,
            created_by UUID REFERENCES vendor_user(id) ON DELETE SET NULL,
            closed_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now(),
            CONSTRAINT uq_pharma_recall_number UNIQUE (vendor_id, recall_number)
        )""",
        """CREATE TABLE IF NOT EXISTS pharma_deviation (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
            number VARCHAR(60) NOT NULL,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            status VARCHAR(30) NOT NULL DEFAULT 'open',
            severity VARCHAR(20) NOT NULL DEFAULT 'minor',
            goods_batch_id UUID REFERENCES goods_batch(id) ON DELETE SET NULL,
            bpr_id UUID REFERENCES pharma_bpr(id) ON DELETE SET NULL,
            production_order_id UUID REFERENCES production_order(id) ON DELETE SET NULL,
            linked_capa_id UUID,
            meta JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_by UUID REFERENCES vendor_user(id) ON DELETE SET NULL,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now(),
            CONSTRAINT uq_pharma_deviation_number UNIQUE (vendor_id, number)
        )""",
        """CREATE TABLE IF NOT EXISTS pharma_capa (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
            number VARCHAR(60) NOT NULL,
            title VARCHAR(255) NOT NULL,
            root_cause TEXT,
            corrective_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
            preventive_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
            status VARCHAR(30) NOT NULL DEFAULT 'open',
            due_date DATE,
            effectiveness_check TEXT,
            deviation_id UUID REFERENCES pharma_deviation(id) ON DELETE SET NULL,
            created_by UUID REFERENCES vendor_user(id) ON DELETE SET NULL,
            closed_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now(),
            CONSTRAINT uq_pharma_capa_number UNIQUE (vendor_id, number)
        )""",
        """CREATE TABLE IF NOT EXISTS pharma_change_control (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
            number VARCHAR(60) NOT NULL,
            title VARCHAR(255) NOT NULL,
            change_type VARCHAR(40) NOT NULL DEFAULT 'other',
            description TEXT,
            status VARCHAR(30) NOT NULL DEFAULT 'draft',
            impact_assessment TEXT,
            target_ref JSONB NOT NULL DEFAULT '{}'::jsonb,
            approvals JSONB NOT NULL DEFAULT '[]'::jsonb,
            created_by UUID REFERENCES vendor_user(id) ON DELETE SET NULL,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now(),
            CONSTRAINT uq_pharma_cc_number UNIQUE (vendor_id, number)
        )""",
        """CREATE TABLE IF NOT EXISTS pharma_audit_event (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
            entity_type VARCHAR(60) NOT NULL,
            entity_id UUID NOT NULL,
            action VARCHAR(60) NOT NULL,
            meaning VARCHAR(120),
            actor_id UUID REFERENCES vendor_user(id) ON DELETE SET NULL,
            actor_name VARCHAR(255),
            old_value JSONB,
            new_value JSONB,
            signature_hash VARCHAR(128),
            ip_address VARCHAR(64),
            esign_verified BOOLEAN NOT NULL DEFAULT false,
            created_at TIMESTAMPTZ DEFAULT now()
        )""",
        "ALTER TABLE pharma_audit_event ADD COLUMN IF NOT EXISTS esign_verified BOOLEAN NOT NULL DEFAULT false",
        "CREATE INDEX IF NOT EXISTS ix_pharma_audit_vendor ON pharma_audit_event (vendor_id)",
        """CREATE TABLE IF NOT EXISTS pharma_serial_unit (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
            goods_batch_id UUID NOT NULL REFERENCES goods_batch(id) ON DELETE CASCADE,
            serial_number VARCHAR(120) NOT NULL,
            parent_id UUID REFERENCES pharma_serial_unit(id) ON DELETE SET NULL,
            level VARCHAR(20) NOT NULL DEFAULT 'unit',
            status VARCHAR(30) NOT NULL DEFAULT 'active',
            meta JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ DEFAULT now(),
            CONSTRAINT uq_pharma_serial_number UNIQUE (vendor_id, serial_number)
        )""",
        "CREATE INDEX IF NOT EXISTS ix_pharma_serial_vendor ON pharma_serial_unit (vendor_id)",
        """CREATE UNIQUE INDEX IF NOT EXISTS uq_pharma_batch_seq_scope
            ON pharma_batch_sequence (
            vendor_id, COALESCE(plant_id, '00000000-0000-0000-0000-000000000000'::uuid),
            COALESCE(product_id, '00000000-0000-0000-0000-000000000000'::uuid), prefix)""",
    ]
    for stmt in stmts:
        op.execute(stmt)


def downgrade() -> None:
    # Non-destructive: leave tables in place (GxP data).
    pass
