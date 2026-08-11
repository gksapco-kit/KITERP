"""Add slug, is_visible, store_scope to rental_asset and create rental_asset_store table.

Revision ID: rent008_slug_is_visible_store_scope
Revises: rent007_extended_rates
Create Date: 2026-08-11
"""

from alembic import op
import sqlalchemy as sa
import re
import uuid as _uuid

revision = "rent008_slug_is_visible_store_scope"
down_revision = "rent007_extended_rates"
branch_labels = None
depends_on = None


def _col_exists(conn, table: str, column: str) -> bool:
    insp = sa.inspect(conn)
    return any(c["name"] == column for c in insp.get_columns(table))


def _table_exists(conn, table: str) -> bool:
    insp = sa.inspect(conn)
    return table in insp.get_table_names()


def _slugify(text: str) -> str:
    """Minimal inline slugify — no external deps."""
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_-]+", "-", text)
    text = text.strip("-")
    return text[:120] or "asset"


def upgrade() -> None:
    conn = op.get_bind()

    # ── Column additions (idempotent) ────────────────────────────────────────

    for col, typedef in [
        ("slug",        sa.Column("slug", sa.String(160), nullable=True)),
        ("is_visible",  sa.Column("is_visible", sa.Boolean, server_default=sa.text("true"), nullable=False)),
        ("store_scope", sa.Column("store_scope", sa.String(20), server_default=sa.text("'all'"), nullable=False)),
    ]:
        if not _col_exists(conn, "rental_asset", col):
            op.add_column("rental_asset", typedef)

    # ── Slug backfill ────────────────────────────────────────────────────────
    # Read all assets; generate slug from name, deduplicate within vendor using asset_code.

    result = conn.execute(
        sa.text("SELECT id, vendor_id, name, asset_code FROM rental_asset WHERE slug IS NULL ORDER BY created_at ASC")
    )
    rows = result.fetchall()

    seen: dict[tuple, set] = {}  # (vendor_id,) -> set of slugs assigned this run

    for row in rows:
        asset_id, vendor_id, name, asset_code = row
        key = (str(vendor_id),)
        if key not in seen:
            existing = conn.execute(
                sa.text("SELECT slug FROM rental_asset WHERE vendor_id = :vid AND slug IS NOT NULL"),
                {"vid": vendor_id},
            ).fetchall()
            seen[key] = {r[0] for r in existing if r[0]}

        base = _slugify(name or "asset")
        slug = base
        if slug in seen[key]:
            # Try appending asset_code
            if asset_code:
                slug = f"{base}-{_slugify(asset_code)}"
            if slug in seen[key]:
                slug = f"{base}-{str(asset_id)[:8]}"

        seen[key].add(slug)
        conn.execute(
            sa.text("UPDATE rental_asset SET slug = :slug WHERE id = :id"),
            {"slug": slug, "id": asset_id},
        )

    # ── Unique index on (vendor_id, slug) ───────────────────────────────────
    # Make slug NOT NULL now that it's backfilled.
    op.alter_column("rental_asset", "slug", nullable=False, existing_type=sa.String(160))

    # Drop existing index if it exists (guard for re-runs).
    try:
        op.drop_index("uq_rental_asset_vendor_slug", table_name="rental_asset")
    except Exception:
        pass
    op.create_index("uq_rental_asset_vendor_slug", "rental_asset", ["vendor_id", "slug"], unique=True)

    # ── rental_asset_store join table ────────────────────────────────────────
    if not _table_exists(conn, "rental_asset_store"):
        op.create_table(
            "rental_asset_store",
            sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True, default=_uuid.uuid4),
            sa.Column("vendor_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False),
            sa.Column("asset_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("rental_asset.id", ondelete="CASCADE"), nullable=False),
            sa.Column("store_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("store.id", ondelete="CASCADE"), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        )
        op.create_index("idx_rental_asset_store_asset", "rental_asset_store", ["asset_id"])
        op.create_index("idx_rental_asset_store_store", "rental_asset_store", ["store_id"])
        op.create_index("uq_rental_asset_store", "rental_asset_store", ["asset_id", "store_id"], unique=True)


def downgrade() -> None:
    try:
        op.drop_table("rental_asset_store")
    except Exception:
        pass
    try:
        op.drop_index("uq_rental_asset_vendor_slug", table_name="rental_asset")
    except Exception:
        pass
    for col in ("store_scope", "is_visible", "slug"):
        try:
            op.drop_column("rental_asset", col)
        except Exception:
            pass
