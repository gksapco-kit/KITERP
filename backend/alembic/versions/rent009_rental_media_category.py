"""Add media JSONB gallery and category_id FK to rental_asset.

Revision ID: rent009_rental_media_category
Revises: rent008_slug_is_visible_store_scope
Create Date: 2026-08-12

IMPORTANT: Postgres uses transactional DDL. Use IF EXISTS / IF NOT EXISTS,
never wrap DROP INDEX in try/except (a failed DROP aborts the transaction).
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "rent009_rental_media_category"
down_revision = "rent008_slug_is_visible_store_scope"
branch_labels = None
depends_on = None


def _col_exists(conn, table: str, column: str) -> bool:
    insp = sa.inspect(conn)
    return any(c["name"] == column for c in insp.get_columns(table))


def upgrade() -> None:
    conn = op.get_bind()

    # ── media JSONB gallery ───────────────────────────────────────────────────
    # Mirrors vendor_service.media: array of {id, url, media_type, is_primary,
    # alt_text, position} objects.  image_url remains as the denormalised
    # primary thumbnail for listings and the builder feed.
    if not _col_exists(conn, "rental_asset", "media"):
        op.add_column(
            "rental_asset",
            sa.Column("media", JSONB, server_default=sa.text("'[]'::jsonb"), nullable=True),
        )

    # Widen existing image_url from VARCHAR(500) to TEXT to match Service
    op.execute(
        sa.text(
            "ALTER TABLE rental_asset ALTER COLUMN image_url TYPE TEXT "
            "USING image_url::text"
        )
    )

    # ── category_id FK to vendor_category ────────────────────────────────────
    # Nullable so existing assets are unaffected.  ON DELETE SET NULL keeps
    # assets alive if the vendor deletes the category node.
    if not _col_exists(conn, "rental_asset", "category_id"):
        op.add_column(
            "rental_asset",
            sa.Column(
                "category_id",
                sa.dialects.postgresql.UUID(as_uuid=True),
                sa.ForeignKey("vendor_category.id", ondelete="SET NULL"),
                nullable=True,
            ),
        )

    op.execute(
        sa.text(
            "CREATE INDEX IF NOT EXISTS ix_rental_asset_category_id "
            "ON rental_asset (vendor_id, category_id)"
        )
    )


def downgrade() -> None:
    op.execute(sa.text("DROP INDEX IF EXISTS ix_rental_asset_category_id"))
    if _col_exists(op.get_bind(), "rental_asset", "category_id"):
        op.drop_column("rental_asset", "category_id")
    if _col_exists(op.get_bind(), "rental_asset", "media"):
        op.drop_column("rental_asset", "media")
    # Restore VARCHAR(500) on downgrade
    op.execute(
        sa.text(
            "ALTER TABLE rental_asset ALTER COLUMN image_url TYPE VARCHAR(500) "
            "USING image_url::varchar(500)"
        )
    )
