"""Repair missing user.portal_temp_password when hr003 was stamped but not applied."""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

revision: str = "hr005_repair_portal_temp_pw"
down_revision: Union[str, None] = "hr004_otp_expires_at"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(conn, table: str, col: str) -> bool:
    r = conn.execute(
        text(
            """
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = :t AND column_name = :c
            """
        ),
        {"t": table, "c": col},
    )
    return r.scalar() is not None


def upgrade() -> None:
    conn = op.get_bind()
    if not _has_column(conn, "user", "portal_temp_password"):
        op.add_column(
            "user",
            sa.Column("portal_temp_password", sa.String(length=100), nullable=True),
        )


def downgrade() -> None:
    conn = op.get_bind()
    if _has_column(conn, "user", "portal_temp_password"):
        op.drop_column("user", "portal_temp_password")
