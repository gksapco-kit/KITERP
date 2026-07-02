"""Merge Alembic heads for dev databases

Revision ID: d003_merge_all_heads
Revises: cat004_category_image_url_len, hr011_offer_template_accent_color, ms010_controlling_area, proc002_pr_header_bu, sales001_vendor_pricing_plans, ter001_territory
Create Date: 2026-07-02
"""
from alembic import op

revision = "d003_merge_all_heads"
down_revision = (
    "cat004_category_image_url_len",
    "hr011_offer_template_accent_color",
    "ms010_controlling_area",
    "proc002_pr_header_bu",
    "sales001_vendor_pricing_plans",
    "ter001_territory",
)
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
