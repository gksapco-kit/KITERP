# app/schemas/vendor_service.py
from pydantic import BaseModel, Field
from typing import Optional, List, Any
from enum import Enum
from uuid import UUID
from decimal import Decimal


class ServiceStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    ARCHIVED = "archived"


class PriceType(str, Enum):
    FIXED = "fixed"
    HOURLY = "hourly"
    QUOTE = "quote"
    FREE = "free"
    SUBSCRIPTION = "subscription"


class SubscriptionPriceType(str, Enum):
    PER_CYCLE = "per_cycle"
    PER_UNIT = "per_unit"


class ServiceType(str, Enum):
    ONE_TIME = "one_time"
    RECURRING = "recurring"
    CONSULTATION = "consultation"
    REPAIR = "repair"
    INSTALLATION = "installation"


# Universal UOM — shared across products and services
class UnitOfMeasurement(str, Enum):
    # Service-oriented
    FIXED = "fixed"
    HOURLY = "hourly"
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    YEARLY = "yearly"
    PER_SESSION = "per_session"
    PER_VISIT = "per_visit"
    PER_TASK = "per_task"
    PER_KM = "per_km"
    PER_UNIT = "per_unit"
    EVENT = "event"
    MILESTONE = "milestone"
    # Product-oriented (shared)
    PIECE = "piece"
    KG = "kg"
    GRAM = "gram"
    LITRE = "litre"
    ML = "ml"
    METER = "meter"
    SQFT = "sqft"
    SQMT = "sqmt"
    PACK = "pack"
    BOX = "box"
    PAIR = "pair"
    SET = "set"
    DOZEN = "dozen"
    BUNDLE = "bundle"
    # Agriculture
    BIGHA = "bigha"
    GUNTHA = "guntha"
    CENT = "cent"
    PER_ACRE = "per_acre"
    PER_HECTARE = "per_hectare"
    PER_BIGHA = "per_bigha"
    BUSHEL = "bushel"
    MAUND = "maund"
    CWT = "cwt"
    GUNNY_BAG = "gunny_bag"
    SACK = "sack"
    BALE = "bale"
    CRATE = "crate"
    TRAY = "tray"
    PUNNET = "punnet"
    KATTA = "katta"
    PLANT = "plant"
    SAPLING = "sapling"
    TREE = "tree"
    SEEDLING = "seedling"
    CUTTING = "cutting"
    BULB = "bulb"
    TUBER = "tuber"
    PER_PLANT = "per_plant"
    PER_TREE = "per_tree"
    HEAD = "head"
    FLOCK = "flock"
    HERD = "herd"
    DOSE = "dose"
    LITRE_PER_ACRE = "litre_per_acre"
    KG_PER_ACRE = "kg_per_acre"


class ServiceMode(str, Enum):
    IN_STORE = "in_store"
    HOME_VISIT = "home_visit"
    BOTH = "both"
    ONLINE = "online"
    CLINIC = "clinic"
    OFFICE = "office"
    WAREHOUSE = "warehouse"
    SALON = "salon"
    STUDIO = "studio"
    LAB = "lab"
    GYM = "gym"
    RESTAURANT = "restaurant"
    WORKSHOP = "workshop"
    FIELD = "field"
    COWORKING = "coworking"
    EVENT_VENUE = "event_venue"
    HOSPITAL = "hospital"
    PHARMACY = "pharmacy"
    SCHOOL = "school"
    OTHER = "other"


# ── Availability ─────────────────────────────────────────────────

class ServiceAvailabilityCreate(BaseModel):
    day_of_week: int = Field(..., ge=0, le=6)
    start_time: str = Field(..., pattern=r"^\d{2}:\d{2}$")
    end_time: str = Field(..., pattern=r"^\d{2}:\d{2}$")
    is_available: bool = True


class ServiceAvailabilityResponse(BaseModel):
    id: str
    day_of_week: int
    start_time: str
    end_time: str
    is_available: bool


# ── Service Plan (subscription tier) ─────────────────────────────

class ServicePlanCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    price: Optional[float] = None
    uom: Optional[str] = "per_session"
    price_type: Optional[str] = "per_cycle"
    service_frequency: Optional[str] = "once"
    service_mode: Optional[str] = "in_store"
    subscription_interval: Optional[str] = None
    subscription_trial_days: Optional[int] = None
    subscription_setup_fee: Optional[float] = None
    subscription_billing_cycles: Optional[int] = None
    subscription_schedule_modes: Optional[List[str]] = None
    duration_minutes: Optional[int] = None
    buffer_minutes: int = 0
    service_capacity: int = 1
    max_quantity_per_order: Optional[int] = Field(None, ge=1)
    min_quantity_per_order: Optional[int] = Field(None, ge=1)
    # Pricing overrides
    plan_price_type: Optional[str] = None
    price_min: Optional[float] = None
    price_max: Optional[float] = None
    currency: str = "INR"
    discount_percentage: Optional[float] = Field(None, ge=0, le=100)
    discount_amount: Optional[float] = None
    offer_label: Optional[str] = Field(None, max_length=100)
    discount_start_date: Optional[str] = None
    discount_end_date: Optional[str] = None
    # Tax overrides
    is_taxable: Optional[bool] = None
    tax_rate: Optional[float] = Field(None, ge=0, le=100)
    sac_code: Optional[str] = Field(None, max_length=8)
    gst_rate: Optional[float] = Field(None, ge=0, le=100)
    # Booking overrides
    requires_booking: Optional[bool] = None
    max_bookings_per_slot: Optional[int] = None
    advance_booking_days: Optional[int] = None
    booking_lead_time_hours: Optional[float] = None
    cancellation_policy: Optional[str] = None
    cancellation_hours: Optional[int] = None
    rescheduling_policy: Optional[str] = None
    no_show_policy: Optional[str] = None
    # Availability overrides
    availability: Optional[List[ServiceAvailabilityCreate]] = None
    # Lifecycle overrides
    service_expiry_date: Optional[str] = None
    validity_period_days: Optional[int] = None
    renewal_required: Optional[bool] = None
    is_active: bool = True
    sort_order: int = 0


class ServicePlanUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    price: Optional[float] = None
    uom: Optional[str] = None
    price_type: Optional[str] = None
    service_frequency: Optional[str] = None
    service_mode: Optional[str] = None
    subscription_interval: Optional[str] = None
    subscription_trial_days: Optional[int] = None
    subscription_setup_fee: Optional[float] = None
    subscription_billing_cycles: Optional[int] = None
    subscription_schedule_modes: Optional[List[str]] = None
    duration_minutes: Optional[int] = None
    buffer_minutes: Optional[int] = None
    service_capacity: Optional[int] = None
    max_quantity_per_order: Optional[int] = Field(None, ge=1)
    min_quantity_per_order: Optional[int] = Field(None, ge=1)
    plan_price_type: Optional[str] = None
    price_min: Optional[float] = None
    price_max: Optional[float] = None
    currency: Optional[str] = None
    discount_percentage: Optional[float] = Field(None, ge=0, le=100)
    discount_amount: Optional[float] = None
    offer_label: Optional[str] = Field(None, max_length=100)
    discount_start_date: Optional[str] = None
    discount_end_date: Optional[str] = None
    is_taxable: Optional[bool] = None
    tax_rate: Optional[float] = Field(None, ge=0, le=100)
    sac_code: Optional[str] = Field(None, max_length=8)
    gst_rate: Optional[float] = Field(None, ge=0, le=100)
    requires_booking: Optional[bool] = None
    max_bookings_per_slot: Optional[int] = None
    advance_booking_days: Optional[int] = None
    booking_lead_time_hours: Optional[float] = None
    cancellation_policy: Optional[str] = None
    cancellation_hours: Optional[int] = None
    rescheduling_policy: Optional[str] = None
    no_show_policy: Optional[str] = None
    availability: Optional[List[ServiceAvailabilityCreate]] = None
    service_expiry_date: Optional[str] = None
    validity_period_days: Optional[int] = None
    renewal_required: Optional[bool] = None
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None


class ServicePlanResponse(BaseModel):
    id: str
    service_id: str
    name: str
    description: Optional[str] = None
    price: Optional[float] = None
    uom: str = "per_session"
    price_type: str = "per_cycle"
    service_frequency: Optional[str] = "once"
    service_mode: Optional[str] = "in_store"
    subscription_interval: Optional[str] = None
    subscription_trial_days: Optional[int] = None
    subscription_setup_fee: Optional[float] = None
    subscription_billing_cycles: Optional[int] = None
    subscription_schedule_modes: List[str] = []
    duration_minutes: Optional[int] = None
    buffer_minutes: int = 0
    service_capacity: int = 1
    max_quantity_per_order: Optional[int] = None
    min_quantity_per_order: Optional[int] = None
    plan_price_type: Optional[str] = None
    price_min: Optional[float] = None
    price_max: Optional[float] = None
    currency: str = "INR"
    discount_percentage: Optional[float] = None
    discount_amount: Optional[float] = None
    offer_label: Optional[str] = None
    discount_start_date: Optional[str] = None
    discount_end_date: Optional[str] = None
    is_taxable: Optional[bool] = None
    tax_rate: Optional[float] = None
    sac_code: Optional[str] = None
    gst_rate: Optional[float] = None
    requires_booking: Optional[bool] = None
    max_bookings_per_slot: Optional[int] = None
    advance_booking_days: Optional[int] = None
    booking_lead_time_hours: Optional[float] = None
    cancellation_policy: Optional[str] = None
    cancellation_hours: Optional[int] = None
    rescheduling_policy: Optional[str] = None
    no_show_policy: Optional[str] = None
    availability: Optional[list] = None
    service_expiry_date: Optional[str] = None
    validity_period_days: Optional[int] = None
    renewal_required: Optional[bool] = None
    is_active: bool = True
    sort_order: int = 0
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


# ── Service Create ───────────────────────────────────────────────

class ServiceCreate(BaseModel):
    # Basic
    name: str = Field(..., min_length=2, max_length=255)
    slug: Optional[str] = None
    material_code: Optional[str] = Field(None, max_length=40)
    description: Optional[str] = None
    short_description: Optional[str] = Field(None, max_length=500)
    brand: Optional[str] = Field(None, max_length=255)
    service_type: Optional[str] = "one_time"
    category: Optional[str] = None
    subcategory: Optional[str] = None
    tags: List[str] = []

    # Pricing
    price_type: PriceType = PriceType.FIXED
    price: Optional[float] = None
    price_min: Optional[float] = None
    price_max: Optional[float] = None
    currency: str = "INR"
    discount_percentage: Optional[float] = Field(None, ge=0, le=100)
    discount_amount: Optional[float] = None
    discount_start_date: Optional[str] = None
    discount_end_date: Optional[str] = None
    offer_label: Optional[str] = Field(None, max_length=100)
    is_on_sale: bool = False
    allow_quote_request: bool = False
    quote_form_config: Optional[list] = []

    # Tax
    is_taxable: bool = True
    tax_rate: Optional[float] = Field(None, ge=0, le=100)
    sac_code: Optional[str] = Field(None, max_length=8)
    gst_rate: Optional[float] = Field(None, ge=0, le=100)

    # Configuration
    uom: Optional[str] = "per_session"
    service_mode: Optional[str] = "in_store"
    duration_minutes: Optional[int] = None
    buffer_minutes: int = 0
    service_capacity: int = 1

    # Subscription
    is_subscription: bool = False
    subscription_interval: Optional[str] = None
    subscription_price: Optional[float] = None
    subscription_price_type: Optional[str] = "per_cycle"
    subscription_trial_days: Optional[int] = None
    subscription_setup_fee: Optional[float] = None
    subscription_billing_cycles: Optional[int] = None
    subscription_schedule_modes: Optional[List[str]] = None

    # Booking
    requires_booking: bool = True
    max_bookings_per_slot: int = 1
    advance_booking_days: int = 30
    booking_lead_time_hours: Optional[float] = None
    cancellation_policy: Optional[str] = None
    cancellation_hours: Optional[int] = None
    rescheduling_policy: Optional[str] = None
    no_show_policy: Optional[str] = None

    # Lifecycle
    service_expiry_date: Optional[str] = None
    validity_period_days: Optional[int] = None
    renewal_required: bool = False

    # Visibility
    status: Optional[str] = "draft"
    is_featured: bool = False
    is_visible: bool = True
    is_popular: bool = False
    is_new_service: bool = False
    store_scope: Optional[str] = "all"
    store_ids: List[str] = []

    # Media
    image_url: Optional[str] = None
    gallery: List[str] = []

    # SEO
    meta_title: Optional[str] = None
    meta_description: Optional[str] = None
    meta_keywords: List[str] = []

    # Advanced
    service_packages: Optional[list] = []
    addons: List[Any] = []
    prerequisites: Optional[str] = None
    whats_included: List[str] = []
    whats_not_included: List[str] = []
    service_areas: List[str] = []

    # Availability (optional; replaces existing slots when provided)
    availability: Optional[List[ServiceAvailabilityCreate]] = None

    # Plans (optional; replaces existing plans when provided)
    plans: Optional[List[ServicePlanCreate]] = None


# ── Service Update ───────────────────────────────────────────────

class ServiceUpdate(BaseModel):
    # Basic
    name: Optional[str] = Field(None, min_length=2, max_length=255)
    material_code: Optional[str] = Field(None, max_length=40)
    description: Optional[str] = None
    short_description: Optional[str] = Field(None, max_length=500)
    brand: Optional[str] = Field(None, max_length=255)
    service_type: Optional[str] = None
    category: Optional[str] = None
    subcategory: Optional[str] = None
    tags: Optional[List[str]] = None

    # Pricing
    price_type: Optional[PriceType] = None
    price: Optional[float] = None
    price_min: Optional[float] = None
    price_max: Optional[float] = None
    currency: Optional[str] = None
    discount_percentage: Optional[float] = Field(None, ge=0, le=100)
    discount_amount: Optional[float] = None
    discount_start_date: Optional[str] = None
    discount_end_date: Optional[str] = None
    offer_label: Optional[str] = Field(None, max_length=100)
    is_on_sale: Optional[bool] = None
    allow_quote_request: Optional[bool] = None
    quote_form_config: Optional[list] = None

    # Tax
    is_taxable: Optional[bool] = None
    tax_rate: Optional[float] = Field(None, ge=0, le=100)
    sac_code: Optional[str] = Field(None, max_length=8)
    gst_rate: Optional[float] = Field(None, ge=0, le=100)

    # Configuration
    uom: Optional[str] = None
    service_mode: Optional[str] = None
    duration_minutes: Optional[int] = None
    buffer_minutes: Optional[int] = None
    service_capacity: Optional[int] = None

    # Subscription
    is_subscription: Optional[bool] = None
    subscription_interval: Optional[str] = None
    subscription_price: Optional[float] = None
    subscription_price_type: Optional[str] = None
    subscription_trial_days: Optional[int] = None
    subscription_setup_fee: Optional[float] = None
    subscription_billing_cycles: Optional[int] = None
    subscription_schedule_modes: Optional[List[str]] = None

    # Booking
    requires_booking: Optional[bool] = None
    max_bookings_per_slot: Optional[int] = None
    advance_booking_days: Optional[int] = None
    booking_lead_time_hours: Optional[float] = None
    cancellation_policy: Optional[str] = None
    cancellation_hours: Optional[int] = None
    rescheduling_policy: Optional[str] = None
    no_show_policy: Optional[str] = None

    # Lifecycle
    service_expiry_date: Optional[str] = None
    validity_period_days: Optional[int] = None
    renewal_required: Optional[bool] = None

    # Visibility
    status: Optional[ServiceStatus] = None
    is_featured: Optional[bool] = None
    is_visible: Optional[bool] = None
    is_popular: Optional[bool] = None
    is_new_service: Optional[bool] = None
    store_scope: Optional[str] = None
    store_ids: Optional[List[str]] = None

    # Media
    image_url: Optional[str] = None
    gallery: Optional[List[str]] = None

    # SEO
    meta_title: Optional[str] = None
    meta_description: Optional[str] = None
    meta_keywords: Optional[List[str]] = None

    # Advanced
    service_packages: Optional[list] = None
    addons: Optional[List[Any]] = None
    prerequisites: Optional[str] = None
    whats_included: Optional[List[str]] = None
    whats_not_included: Optional[List[str]] = None
    service_areas: Optional[List[str]] = None

    # Availability (optional; replaces existing slots when provided)
    availability: Optional[List[ServiceAvailabilityCreate]] = None

    # Plans (optional; replaces existing plans when provided)
    plans: Optional[List[ServicePlanCreate]] = None


# ── Service Response ─────────────────────────────────────────────

class ServiceResponse(BaseModel):
    id: str
    vendor_id: str

    # Basic
    name: str
    slug: str
    material_code: Optional[str] = None
    description: Optional[str] = None
    short_description: Optional[str] = None
    brand: Optional[str] = None
    service_type: str = "one_time"
    category: Optional[str] = None
    subcategory: Optional[str] = None
    tags: List[str] = []

    # Pricing
    price_type: PriceType
    price: Optional[float] = None
    price_min: Optional[float] = None
    price_max: Optional[float] = None
    currency: str = "INR"
    discount_percentage: Optional[float] = None
    discount_amount: Optional[float] = None
    discount_start_date: Optional[str] = None
    discount_end_date: Optional[str] = None
    offer_label: Optional[str] = None

    # Tax
    is_taxable: bool = True
    tax_rate: Optional[float] = None
    sac_code: Optional[str] = None
    gst_rate: Optional[float] = None

    # Configuration
    uom: str = "per_session"
    service_mode: str = "in_store"
    duration_minutes: Optional[int] = None
    buffer_minutes: int = 0
    service_capacity: int = 1

    # Subscription
    is_subscription: bool = False
    subscription_interval: Optional[str] = None
    subscription_price: Optional[float] = None
    subscription_price_type: str = "per_cycle"
    subscription_trial_days: Optional[int] = None
    subscription_setup_fee: Optional[float] = None
    subscription_billing_cycles: Optional[int] = None
    subscription_schedule_modes: List[str] = []

    # Booking
    requires_booking: bool = True
    max_bookings_per_slot: int = 1
    advance_booking_days: int = 30
    booking_lead_time_hours: Optional[float] = None
    cancellation_policy: Optional[str] = None
    cancellation_hours: Optional[int] = None
    rescheduling_policy: Optional[str] = None
    no_show_policy: Optional[str] = None

    # Lifecycle
    service_expiry_date: Optional[str] = None
    validity_period_days: Optional[int] = None
    renewal_required: bool = False

    # Visibility
    status: ServiceStatus
    is_featured: bool = False
    is_visible: bool = True
    is_popular: bool = False
    is_new_service: bool = False
    store_scope: str = "all"
    store_ids: List[str] = []

    # Media
    image_url: Optional[str] = None
    gallery: List[str] = []

    # SEO
    meta_title: Optional[str] = None
    meta_description: Optional[str] = None
    meta_keywords: List[str] = []

    # Advanced
    service_packages: list = []
    addons: List[Any] = []
    prerequisites: Optional[str] = None
    whats_included: List[str] = []
    whats_not_included: List[str] = []
    service_areas: List[str] = []

    # Audit
    created_by: Optional[str] = None
    updated_by: Optional[str] = None
    version_number: int = 1
    view_count: int = 0
    booking_count: int = 0

    # Relations
    availability: List[ServiceAvailabilityResponse] = []
    plans: List[ServicePlanResponse] = []
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    published_at: Optional[str] = None


class ServiceListResponse(BaseModel):
    items: List[ServiceResponse]
    total: int
    page: int
    size: int
    pages: int


# ── Service BOM & Resources ───────────────────────────────────────────────────

class ServiceBOMItemIn(BaseModel):
    component_id: UUID
    qty_per_service: Decimal = Field(gt=0, decimal_places=4)
    unit_cost_override: Optional[Decimal] = None
    auto_reserve: bool = True
    notes: Optional[str] = None


class ServiceBOMItemOut(BaseModel):
    id: UUID
    service_id: UUID
    component_id: UUID
    component_name: str
    component_sku: Optional[str] = None
    component_uom: Optional[str] = None
    component_cost_price: Optional[float] = None
    qty_per_service: float
    unit_cost: float
    line_cost: float
    unit_cost_override: Optional[float] = None
    auto_reserve: bool = True
    notes: Optional[str] = None
    created_at: Optional[str] = None


class ServiceResourceIn(BaseModel):
    resource_type: str = "employee"
    resource_id: Optional[UUID] = None
    resource_name: str
    quantity: float = Field(default=1, gt=0)
    duration_minutes: Optional[int] = Field(default=None, ge=0)
    cost_type: str = "hourly"
    cost_rate: float = Field(default=0, ge=0)
    auto_reserve: bool = True
    notes: Optional[str] = None
    sort_order: int = 0


class ServiceResourceOut(BaseModel):
    id: UUID
    service_id: UUID
    resource_type: str
    resource_id: Optional[str] = None
    resource_name: str
    quantity: float
    duration_minutes: Optional[int] = None
    cost_type: str
    cost_rate: float
    line_cost: float
    auto_reserve: bool = True
    notes: Optional[str] = None
    sort_order: int = 0
    created_at: Optional[str] = None


class ServiceCostSummaryOut(BaseModel):
    material_cost: float
    resource_cost: float
    total_cost: float
    selling_price: Optional[float] = None
    margin: Optional[float] = None
    margin_pct: Optional[float] = None
    bom_items: int
    resources: int
