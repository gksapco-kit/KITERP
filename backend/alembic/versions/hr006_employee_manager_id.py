"""Add reporting manager (manager_id) on hr_employee_profile."""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = "hr006_employee_manager_id"
down_revision: Union[str, None] = "hr005_repair_portal_temp_pw"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "hr_employee_profile",
        sa.Column("manager_id", UUID(as_uuid=True), nullable=True),
    )
    op.create_index(
        "ix_hr_employee_profile_manager_id",
        "hr_employee_profile",
        ["manager_id"],
        unique=False,
    )
    op.create_foreign_key(
        "fk_hr_employee_profile_manager_id",
        "hr_employee_profile",
        "hr_employee_profile",
        ["manager_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_hr_employee_profile_manager_id", "hr_employee_profile", type_="foreignkey")
    op.drop_index("ix_hr_employee_profile_manager_id", table_name="hr_employee_profile")
    op.drop_column("hr_employee_profile", "manager_id")
