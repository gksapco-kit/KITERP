"""Add portal_temp_password_expires_at to user."""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "hr004_otp_expires_at"
down_revision: Union[str, None] = "hr003_portal_temp_pw"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "user",
        sa.Column("portal_temp_password_expires_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("user", "portal_temp_password_expires_at")
