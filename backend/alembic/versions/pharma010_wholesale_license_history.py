"""pharma010 — customer wholesale license history audit trail."""

from alembic import op

revision = "pharma010_wholesale_license_history"
down_revision = "pharma009_complaint_customer"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS pharma_wholesale_license_history (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
            customer_id UUID NOT NULL REFERENCES customer(id) ON DELETE CASCADE,
            action VARCHAR(30) NOT NULL,
            license_number VARCHAR(80),
            license_expires DATE,
            previous_license_number VARCHAR(80),
            previous_license_expires DATE,
            check_ok BOOLEAN,
            detail VARCHAR(500),
            created_by UUID REFERENCES vendor_user(id) ON DELETE SET NULL,
            created_at TIMESTAMPTZ DEFAULT now()
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_pharma_wlic_hist_vendor "
        "ON pharma_wholesale_license_history (vendor_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_pharma_wlic_hist_customer "
        "ON pharma_wholesale_license_history (vendor_id, customer_id)"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS pharma_wholesale_license_history")
