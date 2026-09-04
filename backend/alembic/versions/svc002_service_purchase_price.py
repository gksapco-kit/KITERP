"""Add purchase costing fields to service and service_plan.

Revision ID: svc002_service_purchase_price
Revises: svc001_plan_uom_quantity
Create Date: 2026-09-03

Changes:
- service: add purchase_price (effective/cached), purchase_price_fixed (manual),
           valuation_method (moving_average|fixed|standard, default 'fixed' for services),
           cost_source, cost_updated_at
- service_plan: add cost_price, compare_at_price (previously sent by frontend but not stored)
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import TIMESTAMP

revision = "svc002_service_purchase_price"
down_revision = "svc001_plan_uom_quantity"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)

    # ── service ───────────────────────────────────────────────────────────────
    svc_cols = {c["name"] for c in insp.get_columns("service")}

    new_svc_cols = {
        "purchase_price": sa.Column("purchase_price", sa.Numeric(12, 2), nullable=True),
        "purchase_price_fixed": sa.Column("purchase_price_fixed", sa.Numeric(12, 2), nullable=True),
        "valuation_method": sa.Column(
            "valuation_method", sa.String(20), nullable=False,
            server_default="fixed"
        ),
        "cost_source": sa.Column("cost_source", sa.String(60), nullable=True),
        "cost_updated_at": sa.Column(
            "cost_updated_at", TIMESTAMP(timezone=True), nullable=True
        ),
    }
    for col_name, col_def in new_svc_cols.items():
        if col_name not in svc_cols:
            op.add_column("service", col_def)

    # ── service_plan ──────────────────────────────────────────────────────────
    plan_cols = {c["name"] for c in insp.get_columns("service_plan")}

    for col_name, col_def in [
        ("cost_price", sa.Column("cost_price", sa.Numeric(12, 2), nullable=True)),
        ("compare_at_price", sa.Column("compare_at_price", sa.Numeric(12, 2), nullable=True)),
    ]:
        if col_name not in plan_cols:
            op.add_column("service_plan", col_def)


def downgrade() -> None:
    for col in ("compare_at_price", "cost_price"):
        op.drop_column("service_plan", col)

    for col in (
        "cost_updated_at", "cost_source", "valuation_method",
        "purchase_price_fixed", "purchase_price",
    ):
        op.drop_column("service", col)
