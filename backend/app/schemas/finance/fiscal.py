from __future__ import annotations

from datetime import date
from typing import Any, List, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

FiscalTemplate = Literal["jan_dec", "jul_jun", "apr_mar", "custom"]


class AuditPeriodIn(BaseModel):
    """Post-close window: dates must fall entirely after the fiscal year end."""

    name: str = Field(min_length=1, max_length=30)
    start_date: date
    end_date: date
    model_config = ConfigDict(extra="forbid")

    @field_validator("name")
    @classmethod
    def _strip_name(cls, v: str) -> str:
        return (v or "").strip()


class FiscalYearTemplatedCreate(BaseModel):
    """Create a fiscal year with monthly standard periods, optional post-close audit windows."""

    company_ids: List[UUID] = Field(
        default_factory=list,
        description="Optional: business units to link on create. Leave empty to only define the variant, then link via assign.",
    )
    variant_code: str = Field(
        min_length=1, max_length=40, description="Unique per organisation, e.g. 2026-27 or IN-LOCAL"
    )
    template: FiscalTemplate
    year_anchor: Optional[int] = None
    name: Optional[str] = None
    is_current: bool = False
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    audit_periods: List[AuditPeriodIn] = Field(
        default_factory=list,
        description=(
            "Optional post-FY-close windows (start after fiscal year end) for audit adjustments. "
            "If a window spans more than one calendar month, the server stores one period per month."
        ),
    )
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    @model_validator(mode="before")
    @classmethod
    def _coerce_legacy_company_id(cls, data: Any) -> Any:
        if isinstance(data, dict) and data.get("company_id") and not data.get("company_ids"):
            return {**data, "company_ids": [data["company_id"]]}
        return data

    @field_validator("name")
    @classmethod
    def _strip_fy_name(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        s = v.strip()
        return s or None

    @field_validator("variant_code")
    @classmethod
    def _norm_variant(cls, v: str) -> str:
        s = (v or "").strip().upper()
        if not s:
            raise ValueError("variant_code cannot be empty")
        for ch in s:
            if ch.isalnum() or ch in "._-":
                continue
            raise ValueError("variant_code may only use letters, digits, dot, underscore, hyphen")
        return s

    @model_validator(mode="after")
    def _check_dates(self) -> FiscalYearTemplatedCreate:
        if self.template == "custom":
            if self.start_date is None or self.end_date is None:
                raise ValueError("For template 'custom', start_date and end_date are required")
            if self.end_date < self.start_date:
                raise ValueError("Fiscal year end_date must be on or after start_date")
        else:
            if self.year_anchor is None:
                raise ValueError("year_anchor is required for fixed fiscal templates (jan_dec, jul_jun, apr_mar)")
        return self

    @field_validator("year_anchor")
    @classmethod
    def _check_year(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and (v < 1970 or v > 2200):
            raise ValueError("year_anchor is out of range")
        return v


class FiscalYearLegacyCreate(BaseModel):
    """Create an empty fiscal year shell (no periods)."""

    name: str = Field(min_length=1, max_length=50)
    start_date: date
    end_date: date
    company_ids: List[UUID] = Field(
        default_factory=list,
        description="Optional: link on create; otherwise assign the variant to business units separately.",
    )
    variant_code: str = Field(min_length=1, max_length=40)
    status: str = "open"
    is_current: bool = False
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    @model_validator(mode="before")
    @classmethod
    def _coerce_legacy_company_id_solo(cls, data: Any) -> Any:
        if isinstance(data, dict) and data.get("company_id") and not data.get("company_ids"):
            return {**data, "company_ids": [data["company_id"]]}
        return data

    @field_validator("variant_code")
    @classmethod
    def _norm_legacy_variant(cls, v: str) -> str:
        s = (v or "").strip().upper()
        if not s:
            raise ValueError("variant_code cannot be empty")
        for ch in s:
            if ch.isalnum() or ch in "._-":
                continue
            raise ValueError("variant_code may only use letters, digits, dot, underscore, hyphen")
        return s

    @model_validator(mode="after")
    def _order(self) -> FiscalYearLegacyCreate:
        if self.end_date < self.start_date:
            raise ValueError("end_date must be on or after start_date")
        return self


class FiscalYearAssignCompanies(BaseModel):
    """Attach an existing shared fiscal year calendar to one or more business units."""

    company_ids: List[UUID] = Field(min_length=1)
    is_current: bool = False
    model_config = ConfigDict(extra="forbid")


class AuditPeriodAdd(BaseModel):
    """
    Add a post-close audit / adjustment window for an existing fiscal year.
    A range spanning more than one calendar month is stored as one period per month; the
    create response returns the first of those rows.
    """

    name: str = Field(min_length=1, max_length=30)
    start_date: date
    end_date: date
    model_config = ConfigDict(extra="forbid")

    @field_validator("name")
    @classmethod
    def _strip(cls, v: str) -> str:
        return (v or "").strip()

    @model_validator(mode="after")
    def _range(self) -> AuditPeriodAdd:
        if self.end_date < self.start_date:
            raise ValueError("end_date must be on or after start_date")
        return self
