"""Add document_number and document_line_no to inventory_movement

Revision ID: inv010_movement_document_number
Revises: inv009_stock_cost_layers
Create Date: 2026-09-03

Adds human-readable document numbers (e.g. GRC-000001, ADJ-000003) to every
inventory movement row and seeds the DocumentSequence counters so the
application picks up numbering without collisions.

Backfill strategy
-----------------
Existing rows get numbers assigned by (movement_type, vendor_id, created_at, id)
ordering via a window ROW_NUMBER().  Only prefixes that exist in the data are
seeded into proc_document_sequence.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "inv010_movement_document_number"
down_revision = "inv009_stock_cost_layers"
branch_labels = None
depends_on = None

# Map movement_type → doc prefix  (mirrors MOVEMENT_DOC_PREFIX in inventory_service.py)
_PREFIX_MAP = {
    "purchase": "GRC",
    "stock_in": "SIN",
    "stock_out": "SOU",
    "adjustment": "ADJ",
    "transfer": "TRF",
    "stock_count": "CNT",
    "purchase_return": "RTV",
    "sale": "SAL",
    "sale_return": "SRT",
    "initial": "INI",
    "write_off": "WOF",
}
_DEFAULT_PREFIX = "MOV"


def upgrade() -> None:
    # 1. Add columns
    op.add_column(
        "inventory_movement",
        sa.Column("document_number", sa.String(30), nullable=True),
    )
    op.add_column(
        "inventory_movement",
        sa.Column("document_line_no", sa.Integer, nullable=False, server_default="1"),
    )

    # 2. Create indexes
    op.create_index("idx_inv_docnum", "inventory_movement", ["vendor_id", "document_number"])

    # 3. Backfill document_number for existing rows using a CASE expression so
    #    each (vendor_id, movement_type) group gets sequential numbers.
    #    We use a plain SQL UPDATE with a subquery because Alembic's op.execute
    #    works with any DB that supports window functions (Postgres ≥ 9.4).
    op.execute("""
        WITH ranked AS (
            SELECT
                id,
                vendor_id,
                movement_type,
                ROW_NUMBER() OVER (
                    PARTITION BY vendor_id, movement_type
                    ORDER BY created_at, id
                ) AS rn
            FROM inventory_movement
        ),
        prefixed AS (
            SELECT
                r.id,
                CASE r.movement_type
                    WHEN 'purchase'        THEN 'GRC-' || LPAD(r.rn::text, 8, '0')
                    WHEN 'stock_in'        THEN 'SIN-' || LPAD(r.rn::text, 8, '0')
                    WHEN 'stock_out'       THEN 'SOU-' || LPAD(r.rn::text, 8, '0')
                    WHEN 'adjustment'      THEN 'ADJ-' || LPAD(r.rn::text, 8, '0')
                    WHEN 'transfer'        THEN 'TRF-' || LPAD(r.rn::text, 8, '0')
                    WHEN 'stock_count'     THEN 'CNT-' || LPAD(r.rn::text, 8, '0')
                    WHEN 'purchase_return' THEN 'RTV-' || LPAD(r.rn::text, 8, '0')
                    WHEN 'sale'            THEN 'SAL-' || LPAD(r.rn::text, 8, '0')
                    WHEN 'sale_return'     THEN 'SRT-' || LPAD(r.rn::text, 8, '0')
                    WHEN 'initial'         THEN 'INI-' || LPAD(r.rn::text, 8, '0')
                    WHEN 'write_off'       THEN 'WOF-' || LPAD(r.rn::text, 8, '0')
                    ELSE                       'MOV-' || LPAD(r.rn::text, 8, '0')
                END AS doc_number
            FROM ranked r
        )
        UPDATE inventory_movement im
        SET document_number = p.doc_number
        FROM prefixed p
        WHERE im.id = p.id
    """)

    # 4. Seed proc_document_sequence so the application continues from the
    #    highest backfilled number for each (vendor_id, prefix).
    op.execute("""
        INSERT INTO proc_document_sequence (id, vendor_id, prefix, last_value, width)
        SELECT
            gen_random_uuid(),
            vendor_id,
            CASE movement_type
                WHEN 'purchase'        THEN 'GRC'
                WHEN 'stock_in'        THEN 'SIN'
                WHEN 'stock_out'       THEN 'SOU'
                WHEN 'adjustment'      THEN 'ADJ'
                WHEN 'transfer'        THEN 'TRF'
                WHEN 'stock_count'     THEN 'CNT'
                WHEN 'purchase_return' THEN 'RTV'
                WHEN 'sale'            THEN 'SAL'
                WHEN 'sale_return'     THEN 'SRT'
                WHEN 'initial'         THEN 'INI'
                WHEN 'write_off'       THEN 'WOF'
                ELSE                       'MOV'
            END AS prefix,
            COUNT(*) AS last_value,
            8 AS width
        FROM inventory_movement
        GROUP BY vendor_id, movement_type
        ON CONFLICT (vendor_id, prefix) DO UPDATE
            SET last_value = GREATEST(
                proc_document_sequence.last_value,
                EXCLUDED.last_value
            )
    """)

    # 5. Add unique constraint (partial — only when document_number IS NOT NULL,
    #    so pre-migration NULLs don't violate it; NULLs are always distinct in SQL).
    op.create_unique_constraint(
        "uq_inv_mvt_docnum_line",
        "inventory_movement",
        ["vendor_id", "document_number", "document_line_no"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_inv_mvt_docnum_line", "inventory_movement", type_="unique")
    op.drop_index("idx_inv_docnum", table_name="inventory_movement")
    op.drop_column("inventory_movement", "document_line_no")
    op.drop_column("inventory_movement", "document_number")
