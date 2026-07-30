"""pharma011 — wholesale license document attachments per customer."""

from alembic import op

revision = "pharma011_wholesale_license_documents"
down_revision = "pharma010_wholesale_license_history"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS pharma_wholesale_license_document (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
            customer_id UUID NOT NULL REFERENCES customer(id) ON DELETE CASCADE,
            file_url VARCHAR(1000) NOT NULL,
            filename VARCHAR(255) NOT NULL,
            content_type VARCHAR(120),
            size_bytes INTEGER,
            created_by UUID REFERENCES vendor_user(id) ON DELETE SET NULL,
            created_at TIMESTAMPTZ DEFAULT now()
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_pharma_wlic_doc_vendor "
        "ON pharma_wholesale_license_document (vendor_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_pharma_wlic_doc_customer "
        "ON pharma_wholesale_license_document (vendor_id, customer_id)"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS pharma_wholesale_license_document")
