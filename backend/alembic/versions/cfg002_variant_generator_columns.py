"""add variant_hash / config_selection / search_keywords to product_variant

Revision ID: cfg002_variant_generator_columns
Revises: cfg001_product_config_engine
Create Date: 2026-07-08
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "cfg002_variant_generator_columns"
down_revision: Union[str, None] = "cfg001_product_config_engine"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    cols = {c["name"] for c in insp.get_columns("product_variant")}

    if "config_selection" not in cols:
        op.add_column("product_variant", sa.Column("config_selection", postgresql.JSONB(), nullable=True))
    if "variant_hash" not in cols:
        op.add_column("product_variant", sa.Column("variant_hash", sa.String(64), nullable=True))
    if "search_keywords" not in cols:
        op.add_column("product_variant", sa.Column("search_keywords", sa.Text(), nullable=True))

    existing_indexes = {ix["name"] for ix in insp.get_indexes("product_variant")}
    if "idx_variant_hash_unique" not in existing_indexes:
        op.create_index(
            "idx_variant_hash_unique",
            "product_variant",
            ["product_id", "variant_hash"],
            unique=True,
            postgresql_where=sa.text("variant_hash IS NOT NULL"),
        )


def downgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    existing_indexes = {ix["name"] for ix in insp.get_indexes("product_variant")}
    if "idx_variant_hash_unique" in existing_indexes:
        op.drop_index("idx_variant_hash_unique", table_name="product_variant")

    cols = {c["name"] for c in insp.get_columns("product_variant")}
    for col in ("search_keywords", "variant_hash", "config_selection"):
        if col in cols:
            op.drop_column("product_variant", col)
