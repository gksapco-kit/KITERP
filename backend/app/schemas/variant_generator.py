# app/schemas/variant_generator.py
from pydantic import BaseModel, Field
from typing import Optional, List, Any, Dict
from enum import Enum


class GenerateMode(str, Enum):
    ALL = "all"            # every valid combination
    SELECTED = "selected"  # only the combinations the user explicitly picked in preview
    MISSING = "missing"    # only combinations that don't have a variant yet
    REGENERATE = "regenerate"  # delete previously auto-generated variants, then recreate fresh


class VariantPreviewRequest(BaseModel):
    mode: GenerateMode = GenerateMode.ALL
    excluded_hashes: List[str] = Field(default_factory=list)
    max_combinations: Optional[int] = Field(None, ge=1, le=100_000)


class VariantPreviewItem(BaseModel):
    variant_hash: str
    label: str
    sku_preview: str
    barcode_preview: Optional[str] = None
    selection: Dict[str, Any]
    price_delta: float
    status: str  # "new" | "exists" | "excluded"


class VariantPreviewResponse(BaseModel):
    total_combinations: int
    new_count: int
    existing_count: int
    excluded_count: int
    truncated: bool
    max_combinations: int
    items: List[VariantPreviewItem]


class VariantGenerateRequest(BaseModel):
    mode: GenerateMode = GenerateMode.ALL
    excluded_hashes: List[str] = Field(default_factory=list)
    selected_hashes: Optional[List[str]] = None  # required semantics for mode == SELECTED
    base_price: Optional[float] = Field(None, ge=0)
    currency: str = "INR"
    max_combinations: Optional[int] = Field(None, ge=1, le=100_000)


class VariantGenerateResponse(BaseModel):
    created_count: int
    skipped_existing_count: int
    deleted_count: int  # only non-zero for mode == "regenerate"
    created_variant_ids: List[str]


class InvalidVariantsResponse(BaseModel):
    deleted_count: int
    deleted_variant_ids: List[str]
