"""Add missing pharma indexes and two model columns omitted from pharma001.

Revision ID: pharma003_indexes_and_columns
Revises: pharma002_stage_c
Create Date: 2026-07-27

Catches up Alembic to parity with ensure_pharma_schema() for:
  - pharma_capa.effectiveness_due_date (added only via ALTER in database.py)
  - pharma_change_control.required_approvals (same)
  - ~20 indexes declared in model __table_args__ but absent from pharma001/002
"""
from alembic import op

revision = "pharma003_indexes_and_columns"
down_revision = "pharma002_stage_c"
branch_labels = None
depends_on = None


def upgrade() -> None:
    stmts = [
        # ── Columns missing from pharma001 CREATE TABLE ───────────────────────
        "ALTER TABLE pharma_capa ADD COLUMN IF NOT EXISTS effectiveness_due_date DATE",
        "ALTER TABLE pharma_change_control ADD COLUMN IF NOT EXISTS required_approvals INTEGER NOT NULL DEFAULT 1",

        # ── batch_transaction indexes ─────────────────────────────────────────
        "CREATE INDEX IF NOT EXISTS ix_batch_txn_product ON batch_transaction (vendor_id, product_id)",
        "CREATE INDEX IF NOT EXISTS ix_batch_txn_from_batch ON batch_transaction (from_batch_id)",
        "CREATE INDEX IF NOT EXISTS ix_batch_txn_to_batch ON batch_transaction (to_batch_id)",
        "CREATE INDEX IF NOT EXISTS ix_batch_txn_source ON batch_transaction (vendor_id, source_type, source_id)",
        "CREATE INDEX IF NOT EXISTS ix_batch_txn_created ON batch_transaction (vendor_id, created_at)",

        # ── pharma_mbr indexes ────────────────────────────────────────────────
        "CREATE INDEX IF NOT EXISTS ix_pharma_mbr_vendor ON pharma_mbr (vendor_id)",
        "CREATE INDEX IF NOT EXISTS ix_pharma_mbr_product ON pharma_mbr (vendor_id, product_id)",
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_pharma_mbr_code_ver ON pharma_mbr (vendor_id, code, version)",

        # ── pharma_bpr indexes ────────────────────────────────────────────────
        "CREATE INDEX IF NOT EXISTS ix_pharma_bpr_vendor ON pharma_bpr (vendor_id)",
        "CREATE INDEX IF NOT EXISTS ix_pharma_bpr_batch ON pharma_bpr (vendor_id, batch_number)",
        "CREATE INDEX IF NOT EXISTS ix_pharma_bpr_order ON pharma_bpr (production_order_id)",

        # ── pharma_qc_spec indexes ────────────────────────────────────────────
        "CREATE INDEX IF NOT EXISTS ix_pharma_qc_spec_vendor ON pharma_qc_spec (vendor_id)",
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_pharma_qc_spec_code_ver ON pharma_qc_spec (vendor_id, code, version)",

        # ── pharma_inspection_lot indexes ─────────────────────────────────────
        "CREATE INDEX IF NOT EXISTS ix_pharma_insp_vendor ON pharma_inspection_lot (vendor_id)",
        "CREATE INDEX IF NOT EXISTS ix_pharma_insp_batch ON pharma_inspection_lot (goods_batch_id)",
        "CREATE INDEX IF NOT EXISTS ix_pharma_insp_status ON pharma_inspection_lot (vendor_id, status)",

        # ── pharma_recall indexes ─────────────────────────────────────────────
        "CREATE INDEX IF NOT EXISTS ix_pharma_recall_vendor ON pharma_recall (vendor_id)",

        # ── pharma_deviation indexes ──────────────────────────────────────────
        "CREATE INDEX IF NOT EXISTS ix_pharma_dev_vendor ON pharma_deviation (vendor_id)",

        # ── pharma_capa indexes ───────────────────────────────────────────────
        "CREATE INDEX IF NOT EXISTS ix_pharma_capa_vendor ON pharma_capa (vendor_id)",

        # ── pharma_change_control indexes ─────────────────────────────────────
        "CREATE INDEX IF NOT EXISTS ix_pharma_cc_vendor ON pharma_change_control (vendor_id)",

        # ── pharma_audit_event additional indexes ─────────────────────────────
        "CREATE INDEX IF NOT EXISTS ix_pharma_audit_entity ON pharma_audit_event (vendor_id, entity_type, entity_id)",
        "CREATE INDEX IF NOT EXISTS ix_pharma_audit_created ON pharma_audit_event (vendor_id, created_at)",

        # ── pharma_serial_unit batch index ────────────────────────────────────
        "CREATE INDEX IF NOT EXISTS ix_pharma_serial_batch ON pharma_serial_unit (goods_batch_id)",

        # ── pharma_temp_excursion batch index ─────────────────────────────────
        "CREATE INDEX IF NOT EXISTS ix_pharma_excursion_batch ON pharma_temp_excursion (goods_batch_id)",

        # ── pharma_epcis_event batch index ────────────────────────────────────
        "CREATE INDEX IF NOT EXISTS ix_pharma_epcis_batch ON pharma_epcis_event (goods_batch_id)",
    ]
    for stmt in stmts:
        op.execute(stmt)


def downgrade() -> None:
    # Non-destructive (GxP data). Drop only the indexes; leave columns in place.
    drop_indexes = [
        "ix_pharma_epcis_batch",
        "ix_pharma_excursion_batch",
        "ix_pharma_serial_batch",
        "ix_pharma_audit_created",
        "ix_pharma_audit_entity",
        "ix_pharma_cc_vendor",
        "ix_pharma_capa_vendor",
        "ix_pharma_dev_vendor",
        "ix_pharma_recall_vendor",
        "ix_pharma_insp_status",
        "ix_pharma_insp_batch",
        "ix_pharma_insp_vendor",
        "uq_pharma_qc_spec_code_ver",
        "ix_pharma_qc_spec_vendor",
        "ix_pharma_bpr_order",
        "ix_pharma_bpr_batch",
        "ix_pharma_bpr_vendor",
        "uq_pharma_mbr_code_ver",
        "ix_pharma_mbr_product",
        "ix_pharma_mbr_vendor",
        "ix_batch_txn_created",
        "ix_batch_txn_source",
        "ix_batch_txn_to_batch",
        "ix_batch_txn_from_batch",
        "ix_batch_txn_product",
    ]
    for idx in drop_indexes:
        op.execute(f"DROP INDEX IF EXISTS {idx}")
