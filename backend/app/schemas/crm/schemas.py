"""
Pydantic v2 schemas for the full CRM module. Kept in a single file for
easy navigation - the project already groups schemas by feature elsewhere
but the CRM surface area is wide enough that a single module reads better.
"""
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field

ORM = ConfigDict(from_attributes=True)


# ── Helpers ──────────────────────────────────────────────────────────────────

class PaginatedResponse(BaseModel):
    items: list[Any]
    total: int
    page: int
    size: int
    pages: int


# ── Accounts ─────────────────────────────────────────────────────────────────

class AccountBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    industry: Optional[str] = None
    region: Optional[str] = None
    website: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    annual_revenue: Optional[Decimal] = None
    employee_count: Optional[int] = None
    billing_address: Optional[dict] = None
    shipping_address: Optional[dict] = None
    tags: Optional[list[str]] = None
    custom_fields: Optional[dict] = None
    notes: Optional[str] = None
    parent_id: Optional[UUID] = None
    owner_id: Optional[UUID] = None
    is_active: Optional[bool] = True


class AccountCreate(AccountBase):
    pass


class AccountUpdate(BaseModel):
    name: Optional[str] = None
    industry: Optional[str] = None
    region: Optional[str] = None
    website: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    annual_revenue: Optional[Decimal] = None
    employee_count: Optional[int] = None
    billing_address: Optional[dict] = None
    shipping_address: Optional[dict] = None
    tags: Optional[list[str]] = None
    custom_fields: Optional[dict] = None
    notes: Optional[str] = None
    parent_id: Optional[UUID] = None
    owner_id: Optional[UUID] = None
    is_active: Optional[bool] = None


class AccountResponse(AccountBase):
    model_config = ORM
    id: UUID
    vendor_id: UUID
    number: str
    created_at: datetime
    updated_at: datetime


# ── Contacts ─────────────────────────────────────────────────────────────────

class ContactBase(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=120)
    last_name: Optional[str] = None
    salutation: Optional[str] = None
    record_type: Optional[str] = "person"
    title: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    mobile: Optional[str] = None
    industry: Optional[str] = None
    region: Optional[str] = None
    website: Optional[str] = None
    annual_revenue: Optional[Decimal] = None
    employee_count: Optional[int] = None
    address: Optional[dict] = None
    tags: Optional[list[str]] = None
    custom_fields: Optional[dict] = None
    notes: Optional[str] = None
    lifecycle_stage: Optional[str] = "lead"
    lead_source: Optional[str] = None
    do_not_email: Optional[bool] = False
    do_not_call: Optional[bool] = False
    account_id: Optional[UUID] = None
    parent_contact_id: Optional[UUID] = None
    customer_id: Optional[UUID] = None
    owner_id: Optional[UUID] = None
    is_active: Optional[bool] = True


class ContactCreate(ContactBase):
    pass


class ContactUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    salutation: Optional[str] = None
    record_type: Optional[str] = None
    title: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    mobile: Optional[str] = None
    industry: Optional[str] = None
    region: Optional[str] = None
    website: Optional[str] = None
    annual_revenue: Optional[Decimal] = None
    employee_count: Optional[int] = None
    address: Optional[dict] = None
    tags: Optional[list[str]] = None
    custom_fields: Optional[dict] = None
    notes: Optional[str] = None
    lifecycle_stage: Optional[str] = None
    lead_source: Optional[str] = None
    do_not_email: Optional[bool] = None
    do_not_call: Optional[bool] = None
    account_id: Optional[UUID] = None
    parent_contact_id: Optional[UUID] = None
    customer_id: Optional[UUID] = None
    owner_id: Optional[UUID] = None
    is_active: Optional[bool] = None


class ContactResponse(ContactBase):
    model_config = ORM
    id: UUID
    vendor_id: UUID
    number: Optional[str] = None
    linked_account_id: Optional[UUID] = None
    last_activity_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime


# ── Leads ────────────────────────────────────────────────────────────────────

class LeadBase(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    company: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    title: Optional[str] = None
    website: Optional[str] = None
    source: Optional[str] = None
    source_campaign: Optional[str] = None
    status: Optional[str] = "new"
    score: Optional[int] = 0
    rating: Optional[str] = None
    assigned_to: Optional[UUID] = None
    notes: Optional[str] = None
    tags: Optional[list[str]] = None
    custom_fields: Optional[dict] = None
    intake_payload: Optional[dict] = None


class LeadCreate(LeadBase):
    pass


class LeadUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    company: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    title: Optional[str] = None
    website: Optional[str] = None
    source: Optional[str] = None
    source_campaign: Optional[str] = None
    status: Optional[str] = None
    score: Optional[int] = None
    rating: Optional[str] = None
    assigned_to: Optional[UUID] = None
    notes: Optional[str] = None
    tags: Optional[list[str]] = None
    custom_fields: Optional[dict] = None


class LeadConvertRequest(BaseModel):
    create_deal: bool = True
    deal_title: Optional[str] = None
    deal_amount: Optional[Decimal] = None
    pipeline_id: Optional[UUID] = None
    stage_id: Optional[UUID] = None
    account_id: Optional[UUID] = None
    contact_id: Optional[UUID] = None


class LeadResponse(LeadBase):
    model_config = ORM
    id: UUID
    vendor_id: UUID
    number: str
    converted_at: Optional[datetime] = None
    converted_contact_id: Optional[UUID] = None
    converted_account_id: Optional[UUID] = None
    converted_deal_id: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime


# ── Pipelines / Stages / Deals ───────────────────────────────────────────────

class StageBase(BaseModel):
    name: str
    probability: Decimal = Decimal(0)
    sort_order: int = 0
    is_won: bool = False
    is_lost: bool = False
    color: Optional[str] = None


class StageCreate(StageBase):
    pass


class StageResponse(StageBase):
    model_config = ORM
    id: UUID
    pipeline_id: UUID
    vendor_id: UUID


class PipelineBase(BaseModel):
    name: str
    description: Optional[str] = None
    is_default: bool = False
    is_active: bool = True
    sort_order: int = 0


class PipelineCreate(PipelineBase):
    stages: Optional[list[StageCreate]] = None


class PipelineResponse(PipelineBase):
    model_config = ORM
    id: UUID
    vendor_id: UUID
    stages: list[StageResponse] = []
    created_at: datetime
    updated_at: datetime


class DealBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    pipeline_id: UUID
    stage_id: UUID
    account_id: Optional[UUID] = None
    contact_id: Optional[UUID] = None
    owner_id: Optional[UUID] = None
    amount: Decimal = Decimal(0)
    currency: str = "INR"
    probability: Optional[Decimal] = None
    expected_close_date: Optional[datetime] = None
    status: Optional[str] = "open"
    source: Optional[str] = None
    tags: Optional[list[str]] = None
    custom_fields: Optional[dict] = None


class DealCreate(DealBase):
    pass


class DealUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    pipeline_id: Optional[UUID] = None
    stage_id: Optional[UUID] = None
    account_id: Optional[UUID] = None
    contact_id: Optional[UUID] = None
    owner_id: Optional[UUID] = None
    amount: Optional[Decimal] = None
    currency: Optional[str] = None
    probability: Optional[Decimal] = None
    expected_close_date: Optional[datetime] = None
    status: Optional[str] = None
    lost_reason: Optional[str] = None
    won_reason: Optional[str] = None
    source: Optional[str] = None
    sort_order: Optional[int] = None
    tags: Optional[list[str]] = None
    custom_fields: Optional[dict] = None


class DealResponse(DealBase):
    model_config = ORM
    id: UUID
    vendor_id: UUID
    number: str
    sort_order: int
    closed_at: Optional[datetime] = None
    lost_reason: Optional[str] = None
    won_reason: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class DealMoveRequest(BaseModel):
    stage_id: UUID
    sort_order: Optional[int] = None


# ── Activities ───────────────────────────────────────────────────────────────

class ActivityBase(BaseModel):
    type: str = Field(
        ...,
        pattern="^(task|call|meeting|note|email|reminder|schedule|followup|ticket_followup|technical_support|support|other)$",
    )
    subject: str
    description: Optional[str] = None
    related_type: Optional[str] = None
    related_id: Optional[UUID] = None
    due_at: Optional[datetime] = None
    reminder_at: Optional[datetime] = None
    duration_minutes: Optional[int] = None
    priority: Optional[str] = "normal"
    status: Optional[str] = "open"
    location: Optional[str] = None
    meeting_url: Optional[str] = None
    outcome: Optional[str] = None
    owner_id: Optional[UUID] = None
    custom_fields: Optional[dict] = None


class ActivityCreate(ActivityBase):
    pass


class ActivityUpdate(BaseModel):
    type: Optional[str] = None
    subject: Optional[str] = None
    description: Optional[str] = None
    related_type: Optional[str] = None
    related_id: Optional[UUID] = None
    due_at: Optional[datetime] = None
    reminder_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    duration_minutes: Optional[int] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    location: Optional[str] = None
    meeting_url: Optional[str] = None
    outcome: Optional[str] = None
    owner_id: Optional[UUID] = None
    custom_fields: Optional[dict] = None


class ActivityResponse(ActivityBase):
    model_config = ORM
    id: UUID
    vendor_id: UUID
    number: str
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


# ── Communication logs ───────────────────────────────────────────────────────

class CommunicationCreate(BaseModel):
    channel: str
    direction: str = "outbound"
    subject: Optional[str] = None
    body: Optional[str] = None
    related_type: Optional[str] = None
    related_id: Optional[UUID] = None
    contact_id: Optional[UUID] = None
    provider: Optional[str] = None
    metadata: Optional[dict] = None
    attachments: Optional[list[dict]] = None


class CommunicationResponse(BaseModel):
    model_config = ORM
    id: UUID
    vendor_id: UUID
    channel: str
    direction: str
    subject: Optional[str] = None
    body: Optional[str] = None
    occurred_at: datetime
    related_type: Optional[str] = None
    related_id: Optional[UUID] = None
    contact_id: Optional[UUID] = None
    provider: Optional[str] = None
    status: Optional[str] = None
    sentiment: Optional[str] = None
    external_id: Optional[str] = None


class SendEmailRequest(BaseModel):
    contact_id: UUID
    subject: str
    body_html: str
    body_text: Optional[str] = None


class SendSmsRequest(BaseModel):
    contact_id: Optional[UUID] = None
    to_phone: Optional[str] = None
    body: str


class SendWaRequest(SendSmsRequest):
    pass


class ClickToCallRequest(BaseModel):
    contact_id: Optional[UUID] = None
    to_phone: Optional[str] = None
    twiml_url: Optional[str] = None


# ── Tickets / KB ─────────────────────────────────────────────────────────────

class SlaPolicyBase(BaseModel):
    name: str
    description: Optional[str] = None
    priority: Optional[str] = "normal"
    response_target_minutes: int = 240
    resolution_target_minutes: int = 2880
    business_hours: Optional[dict] = None
    is_active: bool = True


class SlaPolicyCreate(SlaPolicyBase):
    pass


class SlaPolicyResponse(SlaPolicyBase):
    model_config = ORM
    id: UUID
    vendor_id: UUID
    created_at: datetime


class TicketBase(BaseModel):
    subject: str
    description: Optional[str] = None
    contact_id: Optional[UUID] = None
    account_id: Optional[UUID] = None
    assigned_to: Optional[UUID] = None
    sla_policy_id: Optional[UUID] = None
    priority: Optional[str] = "normal"
    status: Optional[str] = "open"
    source: Optional[str] = "manual"
    tags: Optional[list[str]] = None
    custom_fields: Optional[dict] = None


class TicketCreate(TicketBase):
    pass


class TicketUpdate(BaseModel):
    subject: Optional[str] = None
    description: Optional[str] = None
    contact_id: Optional[UUID] = None
    account_id: Optional[UUID] = None
    assigned_to: Optional[UUID] = None
    sla_policy_id: Optional[UUID] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    tags: Optional[list[str]] = None
    custom_fields: Optional[dict] = None


class TicketResponse(TicketBase):
    model_config = ORM
    id: UUID
    vendor_id: UUID
    number: str
    first_response_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None
    sla_breached: bool
    created_at: datetime
    updated_at: datetime


class TicketCommentCreate(BaseModel):
    body: str
    is_internal: bool = False
    attachments: Optional[list[dict]] = None


class TicketCommentResponse(BaseModel):
    model_config = ORM
    id: UUID
    ticket_id: UUID
    author_id: Optional[UUID] = None
    contact_id: Optional[UUID] = None
    body: str
    is_internal: bool
    attachments: list = []
    created_at: datetime


class KbArticleBase(BaseModel):
    title: str
    slug: str
    body: Optional[str] = None
    summary: Optional[str] = None
    tags: Optional[list[str]] = None
    status: Optional[str] = "draft"


class KbArticleCreate(KbArticleBase):
    pass


class KbArticleUpdate(BaseModel):
    title: Optional[str] = None
    slug: Optional[str] = None
    body: Optional[str] = None
    summary: Optional[str] = None
    tags: Optional[list[str]] = None
    status: Optional[str] = None


class KbArticleResponse(KbArticleBase):
    model_config = ORM
    id: UUID
    vendor_id: UUID
    view_count: int
    helpful_count: int
    author_id: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime


# ── Marketing ────────────────────────────────────────────────────────────────

class SegmentBase(BaseModel):
    name: str
    description: Optional[str] = None
    filter_dsl: Optional[dict] = None
    is_active: bool = True


class SegmentCreate(SegmentBase):
    pass


class SegmentResponse(SegmentBase):
    model_config = ORM
    id: UUID
    vendor_id: UUID
    contact_count: int
    last_computed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class TemplateAttachment(BaseModel):
    url: str
    type: str = "image"  # image | video
    name: Optional[str] = None


class EmailTemplateBase(BaseModel):
    name: str
    subject: str
    body_html: str
    body_text: Optional[str] = None
    merge_tags: Optional[list[str]] = None
    channel: str = "email"
    description: Optional[str] = None
    attachments: Optional[list[TemplateAttachment]] = None
    schedule_start: Optional[datetime] = None
    schedule_end: Optional[datetime] = None
    settings: Optional[dict] = None
    is_active: bool = True


class EmailTemplateCreate(EmailTemplateBase):
    pass


class EmailTemplateResponse(EmailTemplateBase):
    model_config = ORM
    id: UUID
    vendor_id: UUID
    created_at: datetime
    updated_at: datetime


class TemplateTestRequest(BaseModel):
    channel: Optional[str] = None
    test_phone: Optional[str] = None
    test_email: Optional[str] = None


class TemplateTestResponse(BaseModel):
    ok: bool
    message: str


class CampaignStepBase(BaseModel):
    sort_order: int = 0
    delay_minutes: int = 0
    channel: str = "email"
    template_id: Optional[UUID] = None
    condition: Optional[dict] = None
    action: Optional[dict] = None


class CampaignStepResponse(CampaignStepBase):
    model_config = ORM
    id: UUID
    campaign_id: UUID


class CampaignBase(BaseModel):
    name: str
    type: str = "one_off"
    channel: str = "email"
    status: str = "draft"
    template_id: Optional[UUID] = None
    segment_id: Optional[UUID] = None
    scheduled_at: Optional[datetime] = None
    settings: Optional[dict] = None


class CampaignCreate(CampaignBase):
    steps: Optional[list[CampaignStepBase]] = None


class CampaignUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    channel: Optional[str] = None
    status: Optional[str] = None
    template_id: Optional[UUID] = None
    segment_id: Optional[UUID] = None
    scheduled_at: Optional[datetime] = None
    settings: Optional[dict] = None
    steps: Optional[list[CampaignStepBase]] = None


class CampaignResponse(CampaignBase):
    model_config = ORM
    id: UUID
    vendor_id: UUID
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    sent_count: int
    open_count: int
    click_count: int
    bounce_count: int
    unsubscribe_count: int
    steps: list[CampaignStepResponse] = []
    created_at: datetime
    updated_at: datetime


# ── Workflows ────────────────────────────────────────────────────────────────

class WorkflowBase(BaseModel):
    name: str
    description: Optional[str] = None
    trigger: dict
    steps: list[dict] = []
    status: str = "active"
    requires_approval: bool = False


class WorkflowCreate(WorkflowBase):
    pass


class WorkflowUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    trigger: Optional[dict] = None
    steps: Optional[list[dict]] = None
    status: Optional[str] = None
    requires_approval: Optional[bool] = None


class WorkflowResponse(WorkflowBase):
    model_config = ORM
    id: UUID
    vendor_id: UUID
    last_run_at: Optional[datetime] = None
    run_count: int
    success_count: int
    failure_count: int
    created_at: datetime
    updated_at: datetime


class WorkflowRunResponse(BaseModel):
    model_config = ORM
    id: UUID
    workflow_id: UUID
    vendor_id: UUID
    entity_type: Optional[str] = None
    entity_id: Optional[UUID] = None
    status: str
    log: list = []
    error: Optional[str] = None
    started_at: datetime
    finished_at: Optional[datetime] = None


# ── Integrations ─────────────────────────────────────────────────────────────

class IntegrationBase(BaseModel):
    provider: str
    label: Optional[str] = None
    settings: Optional[dict] = None


class IntegrationCreate(IntegrationBase):
    credentials: Optional[dict] = None


class IntegrationUpdate(BaseModel):
    label: Optional[str] = None
    status: Optional[str] = None
    settings: Optional[dict] = None
    credentials: Optional[dict] = None


class IntegrationCheckoutActiveRequest(BaseModel):
    checkout_active: bool


class IntegrationTestRequest(BaseModel):
    provider: str
    credentials: Optional[dict] = None
    settings: Optional[dict] = None
    test_email: Optional[str] = None
    test_phone: Optional[str] = None
    integration_id: Optional[UUID] = None


class IntegrationTestResponse(BaseModel):
    ok: bool = True
    message: str


class IntegrationDefaultsResponse(BaseModel):
    provider: str
    configured: bool = False
    credentials: dict = {}
    settings: dict = {}
    key_source: Optional[str] = None
    webhook_url: Optional[str] = None
    webhook_events: Optional[list[str]] = None


class DeliveryChannelStatus(BaseModel):
    ready: bool = False
    provider: Optional[str] = None
    missing: list[str] = []


class DeliveryStatusResponse(BaseModel):
    email: DeliveryChannelStatus
    sms: DeliveryChannelStatus
    whatsapp: DeliveryChannelStatus
    integrations_url: str = "/crm/integrations"


class IntegrationResponse(BaseModel):
    model_config = ORM
    id: UUID
    vendor_id: UUID
    provider: str
    label: Optional[str] = None
    status: str
    settings: dict = {}
    last_synced_at: Optional[datetime] = None
    last_error: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class IntegrationFormResponse(BaseModel):
    id: UUID
    provider: str
    label: Optional[str] = None
    status: str
    settings: dict = {}
    credentials: dict = {}
    stored_secrets: list[str] = []
    webhook_url: Optional[str] = None


# ── AI insights / Audit / Chat / Journey ─────────────────────────────────────

class AiInsightResponse(BaseModel):
    model_config = ORM
    id: UUID
    vendor_id: UUID
    entity_type: str
    entity_id: UUID
    kind: str
    content: dict
    model: Optional[str] = None
    confidence: Optional[Decimal] = None
    generated_at: datetime
    expires_at: Optional[datetime] = None


class AuditLogResponse(BaseModel):
    model_config = ORM
    id: UUID
    vendor_id: UUID
    actor_id: Optional[UUID] = None
    actor_type: str
    entity: str
    entity_id: Optional[UUID] = None
    action: str
    before: Optional[Any] = None
    after: Optional[Any] = None
    ip: Optional[str] = None
    user_agent: Optional[str] = None
    request_path: Optional[str] = None
    created_at: datetime


class ChatMessageBase(BaseModel):
    sender: str
    sender_id: Optional[UUID] = None
    body: Optional[str] = None
    attachments: Optional[list[dict]] = None
    metadata: Optional[dict] = None


class ChatMessageResponse(BaseModel):
    model_config = ORM
    id: UUID
    conversation_id: UUID
    sender: str
    sender_id: Optional[UUID] = None
    body: Optional[str] = None
    attachments: list = []
    created_at: datetime


class ChatConversationResponse(BaseModel):
    model_config = ORM
    id: UUID
    vendor_id: UUID
    contact_id: Optional[UUID] = None
    customer_id: Optional[UUID] = None
    visitor_id: Optional[str] = None
    visitor_name: Optional[str] = None
    visitor_email: Optional[str] = None
    visitor_phone: Optional[str] = None  # added sfq004
    channel: str
    status: str
    assigned_to: Optional[UUID] = None
    bot_handled: bool
    last_message_at: datetime
    created_at: datetime
    converted_lead_id: Optional[UUID] = None
    converted_at: Optional[datetime] = None
    converted_ticket_id: Optional[UUID] = None
    ticket_converted_at: Optional[datetime] = None


class JourneyEventBase(BaseModel):
    event_type: str
    payload: Optional[dict] = None
    contact_id: Optional[UUID] = None
    customer_id: Optional[UUID] = None
    visitor_id: Optional[str] = None


class JourneyEventResponse(JourneyEventBase):
    model_config = ORM
    id: UUID
    vendor_id: UUID
    occurred_at: datetime


# ── Public lead intake / chat widget ─────────────────────────────────────────

class PublicLeadPayload(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    full_name: Optional[str] = None
    company: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    title: Optional[str] = None
    website: Optional[str] = None
    notes: Optional[str] = None
    source: Optional[str] = None
    source_campaign: Optional[str] = None
    extra: Optional[dict] = None


class IntakeTokenCreate(BaseModel):
    label: str
    source_default: Optional[str] = "form"


class IntakeTokenResponse(BaseModel):
    model_config = ORM
    id: UUID
    vendor_id: UUID
    token: str
    label: Optional[str] = None
    source_default: str
    is_active: bool
    created_at: datetime
    last_used_at: Optional[datetime] = None


class WidgetMessagePayload(BaseModel):
    visitor_id: str
    visitor_name: Optional[str] = None
    visitor_email: Optional[EmailStr] = None
    visitor_phone: Optional[str] = None
    body: str
    metadata: Optional[dict] = None


# ── Payment follow-ups & credit control ──────────────────────────────────────

class PaymentFollowupBase(BaseModel):
    party_name: str = Field(..., min_length=1, max_length=255)
    party_phone: Optional[str] = None
    party_email: Optional[EmailStr] = None
    contact_id: Optional[UUID] = None
    amount_due: Decimal = Decimal("0")
    currency: str = "INR"
    invoice_ref: Optional[str] = None
    due_date: Optional[date] = None
    next_followup_at: Optional[datetime] = None
    channel: str = "call"
    priority: str = "normal"
    status: str = "open"
    promise_date: Optional[date] = None
    notes: Optional[str] = None
    owner_id: Optional[UUID] = None


class PaymentFollowupCreate(PaymentFollowupBase):
    pass


class PaymentFollowupUpdate(BaseModel):
    party_name: Optional[str] = Field(None, min_length=1, max_length=255)
    party_phone: Optional[str] = None
    party_email: Optional[EmailStr] = None
    contact_id: Optional[UUID] = None
    amount_due: Optional[Decimal] = None
    currency: Optional[str] = None
    invoice_ref: Optional[str] = None
    due_date: Optional[date] = None
    next_followup_at: Optional[datetime] = None
    channel: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    promise_date: Optional[date] = None
    notes: Optional[str] = None
    owner_id: Optional[UUID] = None


class PaymentFollowupResponse(PaymentFollowupBase):
    model_config = ORM
    id: UUID
    vendor_id: UUID
    number: str
    created_at: datetime
    updated_at: Optional[datetime] = None


class CreditControlBase(BaseModel):
    party_name: str = Field(..., min_length=1, max_length=255)
    party_phone: Optional[str] = None
    party_email: Optional[EmailStr] = None
    contact_id: Optional[UUID] = None
    customer_id: Optional[UUID] = None
    credit_limit: Decimal = Decimal("0")
    max_payment_amount: Decimal = Decimal("0")
    current_outstanding: Decimal = Decimal("0")
    payment_terms_days: int = 30
    payment_blocked: bool = False
    block_reason: Optional[str] = None
    status: str = "active"
    notes: Optional[str] = None


class CreditControlCreate(CreditControlBase):
    pass


class CreditControlUpdate(BaseModel):
    party_name: Optional[str] = Field(None, min_length=1, max_length=255)
    party_phone: Optional[str] = None
    party_email: Optional[EmailStr] = None
    contact_id: Optional[UUID] = None
    customer_id: Optional[UUID] = None
    credit_limit: Optional[Decimal] = None
    max_payment_amount: Optional[Decimal] = None
    current_outstanding: Optional[Decimal] = None
    payment_terms_days: Optional[int] = None
    payment_blocked: Optional[bool] = None
    block_reason: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class CreditControlResponse(CreditControlBase):
    model_config = ORM
    id: UUID
    vendor_id: UUID
    created_at: datetime
    updated_at: Optional[datetime] = None
    available_credit: Optional[Decimal] = None
    over_limit: Optional[bool] = None


class CreditControlCheckRequest(BaseModel):
    """Validate a proposed payment / invoice amount against credit rules."""
    credit_control_id: Optional[UUID] = None
    party_name: Optional[str] = None
    contact_id: Optional[UUID] = None
    customer_id: Optional[UUID] = None
    amount: Decimal = Field(..., gt=0)
    # Dairy/rental: block next booking until prior dues are cleared
    require_zero_outstanding: bool = False


class CreditControlCheckResponse(BaseModel):
    allowed: bool
    reason: Optional[str] = None
    credit_control_id: Optional[UUID] = None
    credit_limit: Optional[Decimal] = None
    max_payment_amount: Optional[Decimal] = None
    current_outstanding: Optional[Decimal] = None
    available_credit: Optional[Decimal] = None
    payment_blocked: bool = False


# ── Sales area dues ───────────────────────────────────────────────────────────

class SalesAreaDuesAgingMixin(BaseModel):
    total_due: Decimal = Decimal("0")
    not_due: Decimal = Decimal("0")
    days_1_30: Decimal = Decimal("0")
    days_31_60: Decimal = Decimal("0")
    days_61_90: Decimal = Decimal("0")
    days_90_plus: Decimal = Decimal("0")
    overdue_due: Decimal = Decimal("0")


class SalesAreaDuesSummaryRow(SalesAreaDuesAgingMixin):
    """One row per sales area in the summary (group header KPIs)."""
    sales_area_id: Optional[UUID] = None   # None → "Unassigned"
    sales_area_code: Optional[str] = None
    sales_area_name: Optional[str] = None
    business_unit_id: Optional[UUID] = None
    business_unit_name: Optional[str] = None
    customer_count: int = 0
    open_invoice_count: int = 0


class SalesAreaDuesSummaryResponse(BaseModel):
    areas: list[SalesAreaDuesSummaryRow]
    totals: SalesAreaDuesAgingMixin


class SalesAreaDuesInvoiceRow(BaseModel):
    """One open invoice listed under a customer on the dues page."""
    id: str
    invoice_number: str
    status: Optional[str] = None
    created_at: Optional[str] = None
    due_date: Optional[date] = None
    total: Decimal = Decimal("0")
    balance_due: Decimal = Decimal("0")


class SalesAreaDuesCustomerRow(SalesAreaDuesAgingMixin):
    """One row per (sales_area, customer) in the detail list."""
    sales_area_id: Optional[UUID] = None
    customer_id: Optional[UUID] = None
    customer_name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    customer_group: Optional[str] = None
    open_invoices: int = 0
    oldest_due_date: Optional[date] = None
    days_overdue: Optional[int] = None
    # From crm_credit_control if one exists
    credit_limit: Optional[Decimal] = None
    payment_blocked: Optional[bool] = None
    invoices: list[SalesAreaDuesInvoiceRow] = []
