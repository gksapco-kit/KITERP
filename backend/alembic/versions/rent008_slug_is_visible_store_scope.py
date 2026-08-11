"""Add slug, is_visible, store_scope to rental_asset and create rental_asset_store table.

Revision ID: rent008_slug_is_visible_store_scope
Revises: rent007_extended_rates
Create Date: 2026-08-11

IMPORTANT: Postgres uses transactional DDL. Never wrap DROP INDEX / CREATE INDEX
in try/except — a failed DROP aborts the transaction and the next CREATE then
raises InFailedSQLTransactionError (seen in prod). Use IF EXISTS / IF NOT EXISTS.
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


def _unique_slug(base: str, used: set[str], asset_id, asset_code: str | None) -> str:
    """Pick a slug unique within the in-memory set (vendor scope)."""
    candidates = [base]
    if asset_code:
        candidates.append(f"{base}-{_slugify(asset_code)}")
    aid = str(asset_id).replace("-", "")
    candidates.append(f"{base}-{aid[:8]}")
    candidates.append(f"asset-{aid[:12]}")

    for c in candidates:
        if c not in used:
            return c

    n = 2
    while True:
        candidate = f"{base}-{aid[:8]}-{n}"
        if candidate not in used:
            return candidate
        n += 1


def upgrade() -> None:
    conn = op.get_bind()

    # ── Column additions (idempotent) ────────────────────────────────────────
    for col, typedef in [
        ("slug", sa.Column("slug", sa.String(160), nullable=True)),
        (
            "is_visible",
            sa.Column(
                "is_visible",
                sa.Boolean,
                server_default=sa.text("true"),
                nullable=False,
            ),
        ),
        (
            "store_scope",
            sa.Column(
                "store_scope",
                sa.String(20),
                server_default=sa.text("'all'"),
                nullable=False,
            ),
        ),
    ]:
        if not _col_exists(conn, "rental_asset", col):
            op.add_column("rental_asset", typedef)

    # ── Slug backfill (NULL only) ────────────────────────────────────────────
    result = conn.execute(
        sa.text(
            "SELECT id, vendor_id, name, asset_code FROM rental_asset "
            "WHERE slug IS NULL ORDER BY created_at ASC NULLS LAST, id ASC"
        )
    )
    rows = result.fetchall()

    seen: dict[str, set[str]] = {}

    for row in rows:
        asset_id, vendor_id, name, asset_code = row
        key = str(vendor_id)
        if key not in seen:
            existing = conn.execute(
                sa.text(
                    "SELECT slug FROM rental_asset "
                    "WHERE vendor_id = :vid AND slug IS NOT NULL"
                ),
                {"vid": vendor_id},
            ).fetchall()
            seen[key] = {r[0] for r in existing if r[0]}

        slug = _unique_slug(_slugify(name or "asset"), seen[key], asset_id, asset_code)
        seen[key].add(slug)
        conn.execute(
            sa.text("UPDATE rental_asset SET slug = :slug WHERE id = :id"),
            {"slug": slug, "id": asset_id},
        )

    # Fix any remaining NULL slugs (safety net)
    conn.execute(
        sa.text(
            "UPDATE rental_asset SET slug = 'asset-' || REPLACE(id::text, '-', '') "
            "WHERE slug IS NULL OR btrim(slug) = ''"
        )
    )

    # Deduplicate existing non-null slugs before unique index
    # (partial prior runs / manual data can leave duplicates).
    dupes = conn.execute(
        sa.text(
            """
            SELECT id, vendor_id, slug
            FROM (
                SELECT id, vendor_id, slug,
                       ROW_NUMBER() OVER (
                           PARTITION BY vendor_id, slug ORDER BY created_at ASC NULLS LAST, id ASC
                       ) AS rn
                FROM rental_asset
                WHERE slug IS NOT NULL
            ) t
            WHERE rn > 1
            """
        )
    ).fetchall()
    for asset_id, vendor_id, slug in dupes:
        key = str(vendor_id)
        if key not in seen:
            existing = conn.execute(
                sa.text(
                    "SELECT slug FROM rental_asset "
                    "WHERE vendor_id = :vid AND slug IS NOT NULL"
                ),
                {"vid": vendor_id},
            ).fetchall()
            seen[key] = {r[0] for r in existing if r[0]}
        new_slug = _unique_slug(slug or "asset", seen[key], asset_id, None)
        seen[key].add(new_slug)
        conn.execute(
            sa.text("UPDATE rental_asset SET slug = :slug WHERE id = :id"),
            {"slug": new_slug, "id": asset_id},
        )

    # Make slug NOT NULL now that it's backfilled.
    op.alter_column(
        "rental_asset",
        "slug",
        nullable=False,
        existing_type=sa.String(160),
    )

    # ── Unique index — IF EXISTS / IF NOT EXISTS (no try/except) ─────────────
    op.execute(sa.text("DROP INDEX IF EXISTS uq_rental_asset_vendor_slug"))
    op.execute(
        sa.text(
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_rental_asset_vendor_slug "
            "ON rental_asset (vendor_id, slug)"
        )
    )

    # ── rental_asset_store join table ────────────────────────────────────────
    if not _table_exists(conn, "rental_asset_store"):
        op.create_table(
            "rental_asset_store",
            sa.Column(
                "id",
                sa.dialects.postgresql.UUID(as_uuid=True),
                primary_key=True,
                default=_uuid.uuid4,
            ),
            sa.Column(
                "vendor_id",
                sa.dialects.postgresql.UUID(as_uuid=True),
                sa.ForeignKey("vendor.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column(
                "asset_id",
                sa.dialects.postgresql.UUID(as_uuid=True),
                sa.ForeignKey("rental_asset.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column(
                "store_id",
                sa.dialects.postgresql.UUID(as_uuid=True),
                sa.ForeignKey("store.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
            ),
        )

    # Idempotent indexes for join table
    op.execute(
        sa.text(
            "CREATE INDEX IF NOT EXISTS idx_rental_asset_store_asset "
            "ON rental_asset_store (asset_id)"
        )
    )
    op.execute(
        sa.text(
            "CREATE INDEX IF NOT EXISTS idx_rental_asset_store_store "
            "ON rental_asset_store (store_id)"
        )
    )
    op.execute(
        sa.text(
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_rental_asset_store "
            "ON rental_asset_store (asset_id, store_id)"
        )
    )


def downgrade() -> None:
    op.execute(sa.text("DROP TABLE IF EXISTS rental_asset_store CASCADE"))
    op.execute(sa.text("DROP INDEX IF EXISTS uq_rental_asset_vendor_slug"))
    for col in ("store_scope", "is_visible", "slug"):
        if _col_exists(op.get_bind(), "rental_asset", col):
            op.drop_column("rental_asset", col)
