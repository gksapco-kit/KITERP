"""Phase 3 — sub-assets (hierarchy + serialized units) + return history.

Revision ID: rent005_sub_assets_return_history
Revises: rent004_return_accounting
Create Date: 2026-08-05

Changes:
  rental_asset
    + parent_asset_id UUID FK → rental_asset(id)  (hierarchy mode)
    + is_bookable     BOOLEAN DEFAULT true
    + unit_mode       VARCHAR(20) DEFAULT 'none'   (none | hierarchy | serialized)

  NEW TABLE rental_asset_unit
    Individual serialized items belonging to a rental_asset.

  NEW TABLE rental_return
    Immutable per-event return audit record.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = "rent005_sub_assets_return_history"
down_revision = "rent004_return_accounting"
branch_labels = None
depends_on = None


def _col_exists(conn, table: str, column: str) -> bool:
    insp = sa.inspect(conn)
    return any(c["name"] == column for c in insp.get_columns(table))


def _table_exists(conn, table: str) -> bool:
    insp = sa.inspect(conn)
    return table in insp.get_table_names()


def upgrade() -> None:
    conn = op.get_bind()

    # ── rental_asset additions ────────────────────────────────────────
    if not _col_exists(conn, "rental_asset", "parent_asset_id"):
        op.add_column(
            "rental_asset",
            sa.Column(
                "parent_asset_id",
                UUID(as_uuid=True),
                sa.ForeignKey("rental_asset.id", ondelete="SET NULL"),
                nullable=True,
            ),
        )
        op.create_index("ix_rental_asset_parent_id", "rental_asset", ["parent_asset_id"])

    if not _col_exists(conn, "rental_asset", "is_bookable"):
        op.add_column(
            "rental_asset",
            sa.Column("is_bookable", sa.Boolean, nullable=True, server_default="true"),
        )

    if not _col_exists(conn, "rental_asset", "unit_mode"):
        op.add_column(
            "rental_asset",
            sa.Column("unit_mode", sa.String(20), nullable=True, server_default="none"),
        )

    # ── rental_asset_unit ─────────────────────────────────────────────
    if not _table_exists(conn, "rental_asset_unit"):
        op.create_table(
            "rental_asset_unit",
            sa.Column("id", UUID(as_uuid=True), primary_key=True),
            sa.Column("asset_id", UUID(as_uuid=True), sa.ForeignKey("rental_asset.id", ondelete="CASCADE"), nullable=False),
            sa.Column("vendor_id", UUID(as_uuid=True), sa.ForeignKey("vendor.id"), nullable=False),
            sa.Column("serial_no", sa.String(100), nullable=False),
            sa.Column("label", sa.String(255)),
            sa.Column("condition", sa.String(20), server_default="good"),
            sa.Column("status", sa.String(20), server_default="available"),
            sa.Column("notes", sa.Text),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
        )
        op.create_index("ix_rental_asset_unit_asset_id", "rental_asset_unit", ["asset_id"])
        op.create_index("ix_rental_asset_unit_vendor_id", "rental_asset_unit", ["vendor_id"])

    # ── rental_return ─────────────────────────────────────────────────
    if not _table_exists(conn, "rental_return"):
        op.create_table(
            "rental_return",
            sa.Column("id", UUID(as_uuid=True), primary_key=True),
            sa.Column("booking_id", UUID(as_uuid=True), sa.ForeignKey("rental_booking.id", ondelete="CASCADE"), nullable=False),
            sa.Column("vendor_id", UUID(as_uuid=True), sa.ForeignKey("vendor.id"), nullable=False),
            sa.Column("quantity_returned", sa.Numeric(12, 2), nullable=False),
            sa.Column("return_condition", sa.String(20), nullable=False, server_default="good"),
            sa.Column("damage_charge", sa.Numeric(12, 2), server_default="0"),
            sa.Column("late_fee", sa.Numeric(12, 2), server_default="0"),
            sa.Column("deposit_refunded", sa.Numeric(12, 2), server_default="0"),
            sa.Column("return_notes", sa.Text),
            sa.Column("unit_ids", JSONB, server_default=sa.text("'[]'::jsonb")),
            sa.Column("returned_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )
        op.create_index("ix_rental_return_booking_id", "rental_return", ["booking_id"])
        op.create_index("ix_rental_return_vendor_id", "rental_return", ["vendor_id"])


def downgrade() -> None:
    op.drop_table("rental_return")
    op.drop_table("rental_asset_unit")
    op.drop_column("rental_asset", "unit_mode")
    op.drop_column("rental_asset", "is_bookable")
    op.drop_index("ix_rental_asset_parent_id", table_name="rental_asset")
    op.drop_column("rental_asset", "parent_asset_id")
