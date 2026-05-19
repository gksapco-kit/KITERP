"""HR employee profile: optional vendor_user link and display full_name."""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = "hr002_emp_vu_optional"
down_revision: Union[str, None] = "vu001_access_window"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "hr_employee_profile",
        sa.Column("full_name", sa.String(length=200), nullable=True),
    )
    op.alter_column(
        "hr_employee_profile",
        "vendor_user_id",
        existing_type=UUID(as_uuid=True),
        nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "hr_employee_profile",
        "vendor_user_id",
        existing_type=UUID(as_uuid=True),
        nullable=False,
    )
    op.drop_column("hr_employee_profile", "full_name")
