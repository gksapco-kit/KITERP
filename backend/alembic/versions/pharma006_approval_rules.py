"""Pharma scoped approval rules — per product / product group / plant / store.

Revision ID: pharma006_approval_rules
Revises: merge001_pg002_pharma005
Create Date: 2026-07-29

New tables:
  pharma_signer_group         — named panels of approvers
  pharma_signer_group_member  — membership
  pharma_approval_rule        — scoped policy per GxP action
  pharma_approval_rule_step   — who may sign at each level

Seeding: one is_default=True rule per action per vendor is seeded from the
current vendor.settings["pharma"] min_approvers_* values so the effective
policy does not change on deploy.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "pharma006_approval_rules"
down_revision = "merge001_pg002_pharma005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── 1. pharma_signer_group ────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS pharma_signer_group (
            id UUID PRIMARY KEY,
            vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
            code VARCHAR(40) NOT NULL,
            name VARCHAR(120) NOT NULL,
            description TEXT,
            is_active BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now(),
            CONSTRAINT uq_pharma_sg_code UNIQUE (vendor_id, code)
        )
    """)
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_pharma_sg_vendor "
        "ON pharma_signer_group (vendor_id)"
    )

    # ── 2. pharma_signer_group_member ─────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS pharma_signer_group_member (
            id UUID PRIMARY KEY,
            group_id UUID NOT NULL REFERENCES pharma_signer_group(id) ON DELETE CASCADE,
            vendor_user_id UUID NOT NULL REFERENCES vendor_user(id) ON DELETE CASCADE,
            created_at TIMESTAMPTZ DEFAULT now(),
            CONSTRAINT uq_pharma_sg_member UNIQUE (group_id, vendor_user_id)
        )
    """)
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_pharma_sg_member_group "
        "ON pharma_signer_group_member (group_id)"
    )

    # ── 3. pharma_approval_rule ───────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS pharma_approval_rule (
            id UUID PRIMARY KEY,
            vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
            action VARCHAR(40) NOT NULL,

            product_id       UUID REFERENCES product(id) ON DELETE CASCADE,
            product_group_id UUID REFERENCES product_group(id) ON DELETE CASCADE,
            plant_id         UUID REFERENCES plant(id) ON DELETE CASCADE,
            store_id         UUID REFERENCES store(id) ON DELETE CASCADE,

            required_approvers INTEGER NOT NULL DEFAULT 2,
            sequential         BOOLEAN NOT NULL DEFAULT false,
            forbid_initiator   BOOLEAN NOT NULL DEFAULT true,
            overrides_default  BOOLEAN NOT NULL DEFAULT false,

            is_default  BOOLEAN NOT NULL DEFAULT false,
            is_active   BOOLEAN NOT NULL DEFAULT true,
            valid_from  DATE,
            valid_to    DATE,
            priority    INTEGER NOT NULL DEFAULT 100,
            version     INTEGER NOT NULL DEFAULT 1,
            notes       TEXT,
            created_by  UUID REFERENCES vendor_user(id) ON DELETE SET NULL,
            created_at  TIMESTAMPTZ DEFAULT now(),
            updated_at  TIMESTAMPTZ DEFAULT now()
        )
    """)
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_pharma_appr_rule_lookup "
        "ON pharma_approval_rule (vendor_id, action, is_active)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_pharma_appr_rule_product "
        "ON pharma_approval_rule (product_id) WHERE product_id IS NOT NULL"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_pharma_appr_rule_group "
        "ON pharma_approval_rule (product_group_id) WHERE product_group_id IS NOT NULL"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_pharma_appr_rule_plant "
        "ON pharma_approval_rule (plant_id) WHERE plant_id IS NOT NULL"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_pharma_appr_rule_store "
        "ON pharma_approval_rule (store_id) WHERE store_id IS NOT NULL"
    )

    # ── 4. pharma_approval_rule_step ──────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS pharma_approval_rule_step (
            id UUID PRIMARY KEY,
            rule_id UUID NOT NULL REFERENCES pharma_approval_rule(id) ON DELETE CASCADE,
            level INTEGER NOT NULL DEFAULT 1,

            signer_type      VARCHAR(20) NOT NULL,
            vendor_user_id   UUID REFERENCES vendor_user(id) ON DELETE CASCADE,
            role_slug        VARCHAR(50),
            permission       VARCHAR(80),
            signer_group_id  UUID REFERENCES pharma_signer_group(id) ON DELETE CASCADE,

            meaning         VARCHAR(20) NOT NULL DEFAULT 'approver',
            min_signatures  INTEGER NOT NULL DEFAULT 1,
            is_mandatory    BOOLEAN NOT NULL DEFAULT true
        )
    """)
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_pharma_appr_step_rule "
        "ON pharma_approval_rule_step (rule_id, level)"
    )

    # ── 5. Seed default rules from existing vendor settings ───────────────────
    # One is_default row per (vendor_id, action) bootstrapped from current
    # vendor.settings["pharma"]["min_approvers_*"] so the effective policy is
    # unchanged.  Uses JSONB extraction; falls back to 2 for release/bpr and 1
    # for capa/cc when the key is absent.
    op.execute("""
        INSERT INTO pharma_approval_rule
            (id, vendor_id, action, required_approvers, is_default, is_active,
             sequential, forbid_initiator, overrides_default, priority, version)
        SELECT
            gen_random_uuid(),
            v.id,
            a.action,
            COALESCE(
                (v.settings->'pharma'->>(
                    CASE a.action
                        WHEN 'batch_release' THEN 'min_approvers_release'
                        WHEN 'bpr_complete'  THEN 'min_approvers_bpr_complete'
                        WHEN 'capa_close'    THEN 'min_approvers_capa_close'
                        WHEN 'cc_approve'    THEN 'min_approvers_cc_approve'
                        ELSE NULL
                    END
                ))::integer,
                CASE a.action
                    WHEN 'batch_release' THEN 2
                    WHEN 'bpr_complete'  THEN 2
                    ELSE 1
                END
            ),
            true,
            true,
            false,
            true,
            false,
            0,
            1
        FROM vendor v
        CROSS JOIN (VALUES
            ('batch_release'), ('bpr_complete'), ('capa_close'), ('cc_approve'),
            ('deviation_close'), ('oos_close'), ('mbr_approve'), ('qc_result_approve')
        ) AS a(action)
        ON CONFLICT DO NOTHING
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS pharma_approval_rule_step")
    op.execute("DROP TABLE IF EXISTS pharma_approval_rule")
    op.execute("DROP TABLE IF EXISTS pharma_signer_group_member")
    op.execute("DROP TABLE IF EXISTS pharma_signer_group")
