# app/schemas/product_config.py
from pydantic import BaseModel, Field
from typing import Optional, List, Any, Dict
from enum import Enum


class InputType(str, Enum):
    DROPDOWN = "dropdown"
    RADIO = "radio"
    CHECKBOX = "checkbox"
    MULTISELECT = "multiselect"
    COLOR = "color"
    IMAGE = "image"
    TEXT = "text"
    NUMBER = "number"
    DATE = "date"
    BOOLEAN = "boolean"


class ComparisonOperator(str, Enum):
    EQUALS = "equals"
    NOT_EQUALS = "not_equals"
    CONTAINS = "contains"
    GREATER_THAN = "gt"
    LESS_THAN = "lt"
    BETWEEN = "between"
    STARTS_WITH = "starts_with"
    ENDS_WITH = "ends_with"


class LogicalOperator(str, Enum):
    AND = "AND"
    OR = "OR"
    NOT = "NOT"


class ActionType(str, Enum):
    SHOW_FIELD = "show_field"
    HIDE_FIELD = "hide_field"
    REQUIRE_FIELD = "require_field"
    DISABLE_OPTION = "disable_option"
    ENABLE_OPTION = "enable_option"
    AUTO_SELECT = "auto_select"
    CHANGE_DEFAULT = "change_default"
    WARNING = "warning"
    ERROR = "error"
    PREVENT_SAVE = "prevent_save"


class ExecutionMode(str, Enum):
    ALWAYS = "always"
    FIRST_MATCH = "first_match"


# ── Attributes ───────────────────────────────────────────────────

class ConfigAttributeCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    display_name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    input_type: InputType = InputType.DROPDOWN
    parent_attribute_id: Optional[str] = None
    display_order: int = 0
    is_required: bool = False
    is_multiple: bool = False
    default_value: Optional[Any] = None
    visibility_rule: Optional[Dict[str, Any]] = None
    validation_rule: Optional[Dict[str, Any]] = None
    labels_i18n: Optional[Dict[str, str]] = None
    is_active: bool = True


class ConfigAttributeUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=120)
    display_name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    input_type: Optional[InputType] = None
    parent_attribute_id: Optional[str] = None
    display_order: Optional[int] = None
    is_required: Optional[bool] = None
    is_multiple: Optional[bool] = None
    default_value: Optional[Any] = None
    visibility_rule: Optional[Dict[str, Any]] = None
    validation_rule: Optional[Dict[str, Any]] = None
    labels_i18n: Optional[Dict[str, str]] = None
    is_active: Optional[bool] = None
    # optimistic concurrency: caller must send the version it last read
    version_number: Optional[int] = None


class ConfigOptionCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    display_name: str = Field(..., min_length=1, max_length=200)
    parent_option_id: Optional[str] = None
    image_url: Optional[str] = None
    icon: Optional[str] = None
    color_code: Optional[str] = None
    price_delta: float = 0.0
    sort_order: int = 0
    labels_i18n: Optional[Dict[str, str]] = None
    is_active: bool = True


class ConfigOptionUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=120)
    display_name: Optional[str] = Field(None, min_length=1, max_length=200)
    parent_option_id: Optional[str] = None
    image_url: Optional[str] = None
    icon: Optional[str] = None
    color_code: Optional[str] = None
    price_delta: Optional[float] = None
    sort_order: Optional[int] = None
    labels_i18n: Optional[Dict[str, str]] = None
    is_active: Optional[bool] = None


# ── Rules ────────────────────────────────────────────────────────

class RuleConditionCreate(BaseModel):
    """Nested condition tree. Either a group (`op` + `children`) or a leaf
    (`attribute` + `operator` + `value`)."""
    op: Optional[LogicalOperator] = None
    children: Optional[List["RuleConditionCreate"]] = None
    attribute: Optional[str] = None
    operator: Optional[ComparisonOperator] = None
    value: Optional[Any] = None
    value2: Optional[Any] = None  # upper bound for "between"


RuleConditionCreate.model_rebuild()


class RuleActionCreate(BaseModel):
    type: ActionType
    target: Optional[str] = None       # attribute or option name the action applies to
    value: Optional[Any] = None        # e.g. required=True, auto-selected option, message text
    message: Optional[str] = None      # for warning/error


class ConfigRuleCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    priority: int = 0
    execution_mode: ExecutionMode = ExecutionMode.ALWAYS
    conditions: Dict[str, Any]
    actions: List[Dict[str, Any]] = Field(default_factory=list)
    is_active: bool = True


class ConfigRuleUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    priority: Optional[int] = None
    execution_mode: Optional[ExecutionMode] = None
    conditions: Optional[Dict[str, Any]] = None
    actions: Optional[List[Dict[str, Any]]] = None
    is_active: Optional[bool] = None
    version_number: Optional[int] = None


class RuleEvaluateRequest(BaseModel):
    """Evaluate every active rule against a candidate selection (attribute name -> value)."""
    selection: Dict[str, Any] = Field(default_factory=dict)
