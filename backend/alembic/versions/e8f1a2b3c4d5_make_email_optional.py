"""make email optional for user and customer

Revision ID: e8f1a2b3c4d5
Revises: 4c9a19eb0609
Create Date: 2026-03-14 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "e8f1a2b3c4d5"
down_revision: Union[str, None] = "4c9a19eb0609"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Make user.email nullable
    op.alter_column("user", "email", existing_type=sa.String(255), nullable=True)

    # Make customer.email nullable
    op.alter_column("customer", "email", existing_type=sa.String(255), nullable=True)

    # Drop old unique constraint on customer (vendor_id, email)
    # and recreate as partial unique index (only where email IS NOT NULL)
    op.drop_index("ix_customer_vendor_email", table_name="customer")
    op.execute(
        'CREATE UNIQUE INDEX ix_customer_vendor_email ON customer (vendor_id, email) WHERE email IS NOT NULL'
    )

    # Add partial unique index for phone per vendor
    op.execute(
        'CREATE UNIQUE INDEX ix_customer_vendor_phone ON customer (vendor_id, phone) WHERE phone IS NOT NULL'
    )


def downgrade() -> None:
    op.drop_index("ix_customer_vendor_phone", table_name="customer")
    op.drop_index("ix_customer_vendor_email", table_name="customer")
    op.create_index("ix_customer_vendor_email", "customer", ["vendor_id", "email"], unique=True)
    op.alter_column("customer", "email", existing_type=sa.String(255), nullable=False)
    op.alter_column("user", "email", existing_type=sa.String(255), nullable=False)
