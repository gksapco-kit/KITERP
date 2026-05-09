"""backfill vendor order acceptance columns if missing

Revision ID: i0a1b2c3d4e5
Revises: h9b0c1d2e3f4
Create Date: 2026-04-05

Fixes 500 on /catalog/vendor/{slug} when DB was marked at head but
order_acceptance_* columns were never applied (broken alembic history).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "i0a1b2c3d4e5"
down_revision: Union[str, None] = "h9b0c1d2e3f4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    cols = {c["name"] for c in insp.get_columns("vendor")}
    if "order_acceptance_enabled" not in cols:
        op.add_column(
            "vendor",
            sa.Column(
                "order_acceptance_enabled",
                sa.Boolean(),
                server_default=sa.text("true"),
                nullable=False,
            ),
        )
    if "order_acceptance_hours" not in cols:
        op.add_column(
            "vendor",
            sa.Column(
                "order_acceptance_hours",
                JSONB(),
                server_default=sa.text("'{}'::jsonb"),
                nullable=True,
            ),
        )


def downgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    cols = {c["name"] for c in insp.get_columns("vendor")}
    if "order_acceptance_hours" in cols:
        op.drop_column("vendor", "order_acceptance_hours")
    if "order_acceptance_enabled" in cols:
        op.drop_column("vendor", "order_acceptance_enabled")
