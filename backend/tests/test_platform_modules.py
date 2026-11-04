"""Module / sub-module permissions for platform support job roles (pure unit tests)."""
import re
from pathlib import Path
from types import SimpleNamespace

import pytest

from app.api.deps import get_effective_permissions
from app.core.platform_modules import (
    MODE_ACCESS,
    MODE_VIEW_ONLY,
    MODULE_ORDER,
    PLATFORM_SCOPED_MARKER,
    SUBMODULES,
    SUBMODULES_BY_MODULE,
    expand_platform_permissions,
    is_vendor_module_permission,
    module_grant,
    vendor_permissions_for,
)
from app.models.platform_job_role import (
    ALL_PLATFORM_PERMISSIONS,
    BUILTIN_PLATFORM_JOB_ROLE_DEFS,
    PLATFORM_ROLE_PERMISSIONS,
)
from app.models.vendor_role import ALL_PERMISSIONS

NAV_FILES = {
    "crm": "crmAdminNav.ts",
    "finance": "financeAdminNav.ts",
    "hr": "hrAdminNav.ts",
}
FRONTEND_LIB = Path(__file__).resolve().parents[2] / "frontend" / "src" / "lib"


@pytest.mark.parametrize("module", MODULE_ORDER)
def test_catalog_matches_admin_sidebar_slugs(module):
    path = FRONTEND_LIB / NAV_FILES[module]
    if not path.exists():
        pytest.skip("frontend sources not available")
    nav = set(re.findall(r"slug: '([^']+)'", path.read_text(encoding="utf-8")))
    assert nav == {s.slug for s in SUBMODULES_BY_MODULE[module]}


def test_mapped_vendor_keys_exist():
    unknown = {k for s in SUBMODULES for k in (*s.view, *s.manage) if k not in ALL_PERMISSIONS}
    assert not unknown
    # Tax filing stays owner-only: never grantable to support staff.
    assert "finance.tax.file" not in {k for s in SUBMODULES for k in (*s.view, *s.manage)}


def test_every_builtin_role_only_uses_known_permissions():
    allowed = set(ALL_PLATFORM_PERMISSIONS)
    for slug, role in BUILTIN_PLATFORM_JOB_ROLE_DEFS.items():
        assert set(expand_platform_permissions(role["permissions"])) <= allowed, slug


def test_legacy_module_key_expands_to_full_module_access():
    perms = expand_platform_permissions(["admin.crm"])
    for s in SUBMODULES_BY_MODULE["crm"]:
        assert (s.manage_key or s.view_key) in perms
    assert "admin.crm" in perms
    # Other modules untouched.
    assert not any(p.startswith("finance.") for p in perms)


def test_manage_implies_view_and_derives_module_key():
    perms = expand_platform_permissions(["crm.leads.manage"])
    assert "crm.leads.view" in perms
    assert "admin.crm" in perms
    assert "admin.finance" not in perms


def test_no_module_grants_means_no_module_access():
    perms = expand_platform_permissions(["admin.dashboard", "crm.leads.view"])
    assert "admin.crm" in perms
    assert "admin.hr" not in perms and "admin.finance" not in perms


def test_view_only_grant_never_includes_write_keys():
    perms = module_grant("finance", view=["coa", "journal", "reports-pnl"])
    vendor = set(vendor_permissions_for(perms))
    assert "finance.view" in vendor
    assert not {k for k in vendor if k.endswith(".manage") or k.endswith(".post") or k.endswith(".create")}


def test_manage_grants_exact_vendor_keys():
    vendor = set(vendor_permissions_for(["crm.leads.manage"]))
    assert vendor == {"crm.view", "crm.leads.manage"}
    vendor = set(vendor_permissions_for(["hr.payroll.manage"]))
    assert vendor == {"hr.view", "hr.payroll"}


def test_access_mode_requires_manage_key_even_to_view():
    ar = next(s for s in SUBMODULES if s.module == "finance" and s.slug == "ar")
    assert ar.mode == MODE_ACCESS and ar.view_key is None
    assert "finance.ar.manage" in vendor_permissions_for(["finance.ar.manage"])
    assert vendor_permissions_for(["finance.ar.view"]) == []  # no such key


def test_view_only_submodules_have_no_manage_key():
    for s in SUBMODULES:
        if s.mode == MODE_VIEW_ONLY:
            assert s.manage_key is None


def test_module_grant_rejects_typos():
    with pytest.raises(KeyError):
        module_grant("crm", manage=["leadz"])


def test_grantable_list_has_no_derived_or_legacy_module_keys():
    for key in ("admin.crm", "admin.finance", "admin.hr"):
        assert key not in PLATFORM_ROLE_PERMISSIONS
        assert key in ALL_PLATFORM_PERMISSIONS


def _vendor_user(permissions, role="platform_staff"):
    return SimpleNamespace(role=role, permissions=permissions, custom_role=None)


def test_unscoped_platform_staff_session_keeps_full_access():
    perms = set(get_effective_permissions(_vendor_user([])))
    assert set(ALL_PERMISSIONS) <= perms


def test_scoped_session_only_has_granted_module_keys():
    granted = vendor_permissions_for(BUILTIN_PLATFORM_JOB_ROLE_DEFS["finance_viewer"]["permissions"])
    perms = set(get_effective_permissions(_vendor_user([PLATFORM_SCOPED_MARKER, *granted])))
    module_keys = {p for p in perms if is_vendor_module_permission(p)}
    assert module_keys == set(granted)
    assert "finance.journal.post" not in perms
    assert "crm.view" not in perms and "hr.view" not in perms
    # Non-module store access is unchanged.
    assert "orders.view" in perms and "products.view" in perms
    assert PLATFORM_SCOPED_MARKER not in perms


def test_scoped_session_with_no_module_grants_has_no_crm_finance_hr():
    perms = set(get_effective_permissions(_vendor_user([PLATFORM_SCOPED_MARKER])))
    assert not any(is_vendor_module_permission(p) for p in perms)
