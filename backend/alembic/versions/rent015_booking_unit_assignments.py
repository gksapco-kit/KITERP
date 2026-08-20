"""Phase 5 — rental_booking_unit: track which serialized units are assigned to each booking.

Revision ID: rent015_booking_unit_assignments
Revises: rent014_delivery_enabled
Create Date: 2026-08-19

New table: rental_booking_unit
  Maps a specific RentalAssetUnit to a RentalBooking.
  released_at = NULL  → currently assigned
  released_at = set   → returned / reassigned (history row)
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


revision = "rent015_booking_unit_assignments"
down_revision = "rent014_delivery_enabled"
branch_labels = None
depends_on = None


def _table_exists(conn, table: str) -> bool:
    insp = sa.inspect(conn)
    return table in insp.get_table_names()


def upgrade() -> None:
    conn = op.get_bind()
    if not _table_exists(conn, "rental_booking_unit"):
        op.create_table(
            "rental_booking_unit",
            sa.Column("id", UUID(as_uuid=True), primary_key=True),
            sa.Column(
                "booking_id",
                UUID(as_uuid=True),
                sa.ForeignKey("rental_booking.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column(
                "unit_id",
                UUID(as_uuid=True),
                sa.ForeignKey("rental_asset_unit.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("vendor_id", UUID(as_uuid=True), sa.ForeignKey("vendor.id"), nullable=False),
            sa.Column("assigned_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("released_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("assigned_by", sa.String(255)),
            sa.Column("notes", sa.Text),
        )
        op.create_index("ix_rental_booking_unit_booking_id", "rental_booking_unit", ["booking_id"])
        op.create_index("ix_rental_booking_unit_unit_id", "rental_booking_unit", ["unit_id"])
        op.create_index(
            "uq_rental_booking_unit_active",
            "rental_booking_unit",
            ["booking_id", "unit_id"],
            unique=True,
        )


def downgrade() -> None:
    op.drop_table("rental_booking_unit")
