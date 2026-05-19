"""Add portal_temp_password to user for HR one-time password flow."""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "hr003_portal_temp_pw"
down_revision: Union[str, None] = "hr002_emp_vu_optional"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "user",
        sa.Column("portal_temp_password", sa.String(length=100), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("user", "portal_temp_password")
