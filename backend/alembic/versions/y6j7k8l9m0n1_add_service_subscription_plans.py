"""add service subscription fields and service_plan table

Revision ID: y6j7k8l9m0n1
Revises: x5g6h7i8j9k0
Create Date: 2026-04-10

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = "y6j7k8l9m0n1"
down_revision = "x5g6h7i8j9k0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Subscription fields on service ────────────────────────────
    op.add_column("service", sa.Column("is_subscription", sa.Boolean(), server_default=sa.text("false"), nullable=True))
    op.add_column("service", sa.Column("subscription_interval", sa.String(30), nullable=True))
    op.add_column("service", sa.Column("subscription_price", sa.Numeric(12, 2), nullable=True))
    op.add_column("service", sa.Column("subscription_price_type", sa.String(20), server_default=sa.text("'per_cycle'"), nullable=True))
    op.add_column("service", sa.Column("subscription_trial_days", sa.Integer(), nullable=True))
    op.add_column("service", sa.Column("subscription_setup_fee", sa.Numeric(12, 2), nullable=True))
    op.add_column("service", sa.Column("subscription_billing_cycles", sa.Integer(), nullable=True))
    op.add_column(
        "service",
        sa.Column(
            "subscription_schedule_modes",
            JSONB,
            server_default=sa.text("""'["dates","cycles","pick_dates","weekly","recurring"]'::jsonb"""),
            nullable=True,
        ),
    )

    # ── service_plan table ─────────────────────────────────────────
    op.create_table(
        "service_plan",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("service_id", UUID(as_uuid=True), sa.ForeignKey("service.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("price", sa.Numeric(12, 2), nullable=True),
        sa.Column("uom", sa.String(30), server_default=sa.text("'per_session'"), nullable=True),
        sa.Column("price_type", sa.String(20), server_default=sa.text("'per_cycle'"), nullable=True),
        sa.Column("subscription_interval", sa.String(30), nullable=True),
        sa.Column("subscription_trial_days", sa.Integer(), nullable=True),
        sa.Column("subscription_setup_fee", sa.Numeric(12, 2), nullable=True),
        sa.Column("subscription_billing_cycles", sa.Integer(), nullable=True),
        sa.Column(
            "subscription_schedule_modes",
            JSONB,
            server_default=sa.text("""'["dates","cycles","pick_dates","weekly","recurring"]'::jsonb"""),
            nullable=True,
        ),
        sa.Column("duration_minutes", sa.Integer(), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=True),
        sa.Column("sort_order", sa.Integer(), server_default=sa.text("0"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("idx_service_plan_service", "service_plan", ["service_id"])


def downgrade() -> None:
    op.drop_index("idx_service_plan_service", table_name="service_plan")
    op.drop_table("service_plan")
    for col in [
        "is_subscription", "subscription_interval", "subscription_price",
        "subscription_price_type", "subscription_trial_days", "subscription_setup_fee",
        "subscription_billing_cycles", "subscription_schedule_modes",
    ]:
        op.drop_column("service", col)
