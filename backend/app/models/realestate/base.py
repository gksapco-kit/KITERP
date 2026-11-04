"""Shared helpers for the Real Estate vertical (all tables are prefixed ``re_``)."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Numeric, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import declared_attr
from sqlalchemy.types import TypeDecorator

from app.database import Base

__all__ = [
    "Base", "REMixin", "fk", "money", "qty", "pct", "txt", "choice", "jsonb_list", "jsonb_dict",
    "now_utc", "JSONB", "UUID", "EncryptedSecrets", "is_secret_key", "ENC_PREFIX", "walk_secrets",
]


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


SECRET_HINTS = ("key", "secret", "token", "password", "passwd", "pwd", "credential", "private")
ENC_PREFIX = "enc:v1:"


def is_secret_key(name) -> bool:
    n = str(name).lower()
    return any(h in n for h in SECRET_HINTS)


def walk_secrets(value, fn):
    if isinstance(value, dict):
        return {k: (fn(v) if is_secret_key(k) and isinstance(v, str) and v != "" else walk_secrets(v, fn))
                for k, v in value.items()}
    if isinstance(value, list):
        return [walk_secrets(v, fn) for v in value]
    return value


def _enc(v: str) -> str:
    if v.startswith(ENC_PREFIX):
        return v
    from app.core.encryption import encrypt_str

    return ENC_PREFIX + (encrypt_str(v) or "")


def _dec(v: str) -> str:
    if not v.startswith(ENC_PREFIX):
        return v  # legacy plaintext written before encryption was switched on
    from app.core.encryption import decrypt_str

    plain = decrypt_str(v[len(ENC_PREFIX):])
    return v if plain is None else plain  # undecryptable (rotated key): keep the token rather than lose it


class EncryptedSecrets(TypeDecorator):
    """JSONB column whose secret-looking string values (api keys, tokens, passwords...) are Fernet-encrypted at rest.

    Application code always sees plaintext; the database (and any backup/dump of it) only sees ``enc:v1:<token>``.
    Legacy plaintext rows are still read and get encrypted the next time they are written.
    """

    impl = JSONB
    cache_ok = True

    def process_bind_param(self, value, dialect):
        return walk_secrets(value, _enc) if value is not None else None

    def process_result_value(self, value, dialect):
        return walk_secrets(value, _dec) if value is not None else None


class REMixin:
    """Primary key, tenant scope and audit timestamps shared by every ``re_*`` table."""

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    @declared_attr
    def vendor_id(cls):  # noqa: N805
        return Column(
            UUID(as_uuid=True),
            ForeignKey("vendor.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        )

    created_at = Column(DateTime(timezone=True), default=now_utc, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False)


def fk(table: str, *, nullable: bool = True, ondelete: str = "SET NULL", index: bool = True):
    """UUID foreign key to ``<table>.id``."""
    return Column(
        UUID(as_uuid=True),
        ForeignKey(f"{table}.id", ondelete=ondelete),
        nullable=nullable,
        index=index,
    )


def money(default=0, nullable: bool = True):
    return Column(Numeric(16, 2), default=default, nullable=nullable)


def qty(default=0, nullable: bool = True):
    return Column(Numeric(16, 3), default=default, nullable=nullable)


def pct(default=0, nullable: bool = True):
    return Column(Numeric(7, 3), default=default, nullable=nullable)


def txt(length: int = 255, *, nullable: bool = True, default=None, index: bool = False):
    return Column(String(length), nullable=nullable, default=default, index=index)


def choice(values: list[str], default: str, length: int = 40, *, index: bool = True):
    """String column restricted (at API level) to ``values``."""
    return Column(String(length), nullable=False, default=default, index=index, info={"choices": values})


def jsonb_list():
    return Column(JSONB, default=list)


def jsonb_dict():
    return Column(JSONB, default=dict)
