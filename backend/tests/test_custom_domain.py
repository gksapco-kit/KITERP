"""Unit tests for custom domain hostname helpers."""
from app.utils.custom_domain import (
    host_lookup_candidates,
    is_platform_hostname,
    normalize_hostname,
    strip_www,
    sync_vendor_custom_domain_from_external,
)


class _V:
    def __init__(self, **kw):
        self.custom_domain = kw.get("custom_domain")
        self.domain_verified = kw.get("domain_verified", False)
        self.external_domain_name = kw.get("external_domain_name")
        self.external_domain_access_status = kw.get("external_domain_access_status", "not_requested")


def test_normalize_and_candidates():
    assert normalize_hostname("HTTPS://WWW.VedikaRaksha.com/path") == "www.vedikaraksha.com"
    assert strip_www("www.vedikaraksha.com") == "vedikaraksha.com"
    c = host_lookup_candidates("www.vedikaraksha.com")
    assert "vedikaraksha.com" in c
    assert "www.vedikaraksha.com" in c


def test_platform_hostname():
    assert is_platform_hostname("kiterp.com", "kiterp.com")
    assert is_platform_hostname("www.kiterp.com", "kiterp.com")
    assert is_platform_hostname("vedika-raksha.kiterp.com", "kiterp.com")
    assert is_platform_hostname("localhost", "kiterp.com")
    assert not is_platform_hostname("vedikaraksha.com", "kiterp.com")
    assert not is_platform_hostname("www.vedikaraksha.com", "kiterp.com")


def test_sync_active_sets_custom_domain():
    v = _V(
        external_domain_name="www.vedikaraksha.com",
        external_domain_access_status="active",
    )
    assert sync_vendor_custom_domain_from_external(v) is True
    assert v.custom_domain == "vedikaraksha.com"
    assert v.domain_verified is True


def test_sync_revoke_clears_matching_domain():
    v = _V(
        custom_domain="vedikaraksha.com",
        domain_verified=True,
        external_domain_name="vedikaraksha.com",
        external_domain_access_status="revoked",
    )
    assert sync_vendor_custom_domain_from_external(v) is True
    assert v.custom_domain is None
    assert v.domain_verified is False
