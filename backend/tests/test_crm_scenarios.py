"""
End-to-end CRM scenario coverage.

Exercises every CRM service the vendor app exposes (the same service layer the
FastAPI routes call) against the in-memory SQLite harness from conftest.

Scenarios are grouped by CRM module so the test report reads as a feature
checklist: Accounts, Contacts, Leads, Pipeline/Deals, Activities,
Communications, Tickets/SLA/KB, Marketing (segments/templates/campaigns),
Workflows, Integrations, Chat, Journey, Audit, AI, Lead-intake, Reports, plus
tenant-isolation negative paths.

Each test is intentionally small and asserts one observable behaviour so a
failure points straight at the broken scenario.
"""

import uuid
from decimal import Decimal

import pytest
import pytest_asyncio

from app.models.vendor import Vendor
from app.models.user import User
from app.schemas.crm.schemas import (
    AccountCreate, AccountUpdate,
    ActivityCreate, ActivityUpdate,
    CampaignCreate, CampaignStepBase,
    CommunicationCreate,
    ContactCreate, ContactUpdate,
    DealCreate, DealMoveRequest, DealUpdate,
    EmailTemplateCreate,
    IntakeTokenCreate,
    IntegrationCreate, IntegrationUpdate,
    JourneyEventBase,
    KbArticleCreate, KbArticleUpdate,
    LeadConvertRequest, LeadCreate, LeadUpdate,
    PipelineCreate, StageCreate,
    SegmentCreate,
    SlaPolicyCreate,
    TicketCommentCreate, TicketCreate, TicketUpdate,
    WorkflowCreate, WorkflowUpdate,
)
from app.services.crm.services import (
    AccountService, ActivityService, AiService, AuditQueryService,
    CampaignService, ChatService, CommunicationService, ContactService,
    DealService, EmailTemplateService, IntakeTokenService, IntegrationService,
    JourneyService, KbService, LeadService, PipelineService, ReportService,
    SegmentService, SlaPolicyService, TicketService, WorkflowService,
)


# ── Shared fixtures ──────────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def vid(test_vendor: Vendor):
    return test_vendor.id


@pytest_asyncio.fixture
async def actor(test_user: User):
    return test_user.id


@pytest_asyncio.fixture
async def default_pipeline(db_session, test_vendor):
    """Default 6-stage pipeline created via the service path."""
    return await PipelineService(db_session).ensure_default(test_vendor.id)


def _won_stage(pipeline):
    return next(s for s in pipeline.stages if s.is_won)


def _first_stage(pipeline):
    return pipeline.stages[0]


# ══════════════════════════════════════════════════════════════════════════════
# ACCOUNTS
# ══════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_account_create_get_update_delete(db_session, vid, actor):
    svc = AccountService(db_session)
    acc = await svc.create(vid, AccountCreate(name="Acme Corp", industry="tech",
                                              email="ops@acme.example.com"), actor_id=actor)
    assert acc.id and acc.name == "Acme Corp"

    fetched = await svc.get(vid, acc.id)
    assert fetched.industry == "tech"

    updated = await svc.update(vid, acc.id, AccountUpdate(industry="saas"), actor_id=actor)
    assert updated.industry == "saas"

    await svc.delete(vid, acc.id, actor_id=actor)
    with pytest.raises(Exception) as exc:
        await svc.get(vid, acc.id)
    assert "not found" in str(getattr(exc.value, "detail", exc.value)).lower()


@pytest.mark.asyncio
async def test_account_search_by_name(db_session, vid):
    svc = AccountService(db_session)
    await svc.create(vid, AccountCreate(name="Globex"))
    await svc.create(vid, AccountCreate(name="Initech"))
    items, total = await svc.list(vid, q="glob")
    assert total == 1 and items[0].name == "Globex"


# ══════════════════════════════════════════════════════════════════════════════
# CONTACTS
# ══════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_contact_crud_and_account_link(db_session, vid, actor):
    accounts = AccountService(db_session)
    acc = await accounts.create(vid, AccountCreate(name="Linked Co"))

    svc = ContactService(db_session)
    c = await svc.create(vid, ContactCreate(first_name="Jane", last_name="Doe",
                                            email="jane@linked.example.com",
                                            account_id=acc.id), actor_id=actor)
    assert c.account_id == acc.id

    c = await svc.update(vid, c.id, ContactUpdate(title="VP Sales"), actor_id=actor)
    assert c.title == "VP Sales"

    items, total = await svc.list(vid, q="jane")
    assert total == 1

    await svc.delete(vid, c.id, actor_id=actor)
    items, total = await svc.list(vid)
    assert total == 0


# ══════════════════════════════════════════════════════════════════════════════
# LEADS
# ══════════════════════════════════════════════════════════════════════════════

@pytest_asyncio.fixture
async def a_lead(db_session, vid):
    return await LeadService(db_session).create(
        vid, LeadCreate(first_name="Sam", last_name="Lead", company="Prospect Inc",
                        email="sam@prospect.example.com", source="web"))


@pytest.mark.asyncio
async def test_lead_create_update_assign(db_session, vid, actor, a_lead):
    svc = LeadService(db_session)
    upd = await svc.update(vid, a_lead.id, LeadUpdate(status="qualified", rating="hot"))
    assert upd.status == "qualified" and upd.rating == "hot"

    assigned = await svc.assign(vid, a_lead.id, actor, actor_id=actor)
    assert assigned.assigned_to == actor


@pytest.mark.asyncio
async def test_lead_search_by_status(db_session, vid):
    svc = LeadService(db_session)
    await svc.create(vid, LeadCreate(first_name="New", status="new"))
    await svc.create(vid, LeadCreate(first_name="Qual", status="qualified"))
    items, total = await svc.list(vid, status="qualified")
    assert total == 1 and items[0].first_name == "Qual"


@pytest.mark.asyncio
async def test_lead_convert_to_account_contact(db_session, vid, a_lead):
    svc = LeadService(db_session)
    result = await svc.convert(vid, a_lead.id, LeadConvertRequest(create_deal=False))
    assert result["account"].name == "Prospect Inc"
    assert result["contact"].first_name == "Sam"
    assert result["deal"] is None
    refreshed = await svc.get(vid, a_lead.id)
    assert refreshed.status == "converted"


@pytest.mark.asyncio
async def test_lead_convert_creates_deal_in_default_pipeline(db_session, vid, a_lead):
    """create_deal with no pipeline/stage should auto-pick the default pipeline."""
    svc = LeadService(db_session)
    result = await svc.convert(vid, a_lead.id,
                               LeadConvertRequest(create_deal=True,
                                                  deal_amount=Decimal("25000")))
    assert result["deal"] is not None
    assert result["deal"].amount == Decimal("25000")


@pytest.mark.asyncio
async def test_lead_convert_twice_rejected(db_session, vid, a_lead):
    svc = LeadService(db_session)
    await svc.convert(vid, a_lead.id, LeadConvertRequest(create_deal=False))
    with pytest.raises(Exception) as exc:
        await svc.convert(vid, a_lead.id, LeadConvertRequest(create_deal=False))
    assert "already converted" in str(getattr(exc.value, "detail", exc.value)).lower()


@pytest.mark.asyncio
async def test_lead_delete(db_session, vid, a_lead):
    svc = LeadService(db_session)
    await svc.delete(vid, a_lead.id)
    with pytest.raises(Exception):
        await svc.get(vid, a_lead.id)


# ══════════════════════════════════════════════════════════════════════════════
# PIPELINE / STAGES / DEALS
# ══════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_pipeline_autocreate_default(db_session, vid):
    svc = PipelineService(db_session)
    items = await svc.list(vid)  # none exist → should bootstrap a default
    assert len(items) == 1
    assert any(s.is_won for s in items[0].stages)
    assert any(s.is_lost for s in items[0].stages)


@pytest.mark.asyncio
async def test_pipeline_create_custom_with_stages(db_session, vid):
    svc = PipelineService(db_session)
    p = await svc.create(vid, PipelineCreate(
        name="Renewals",
        stages=[StageCreate(name="Open", probability=Decimal(20), sort_order=0),
                StageCreate(name="Won", probability=Decimal(100), is_won=True, sort_order=1)],
    ))
    assert p.name == "Renewals"
    assert len(p.stages) == 2


@pytest.mark.asyncio
async def test_pipeline_add_and_delete_stage(db_session, vid, default_pipeline):
    svc = PipelineService(db_session)
    stage = await svc.add_stage(vid, default_pipeline.id,
                                StageCreate(name="Demo", probability=Decimal(40), sort_order=99))
    assert stage.name == "Demo"
    await svc.delete_stage(vid, stage.id)
    refreshed = await svc.get(vid, default_pipeline.id)
    assert all(s.name != "Demo" for s in refreshed.stages)


@pytest.mark.asyncio
async def test_deal_create_and_kanban(db_session, vid, default_pipeline):
    svc = DealService(db_session)
    stage = _first_stage(default_pipeline)
    await svc.create(vid, DealCreate(title="Big Deal", pipeline_id=default_pipeline.id,
                                     stage_id=stage.id, amount=Decimal("100000")))
    board = await svc.kanban(vid, default_pipeline.id)
    placed = [c for c in board["columns"] if str(c["stage"].id) == str(stage.id)][0]
    assert len(placed["deals"]) == 1


@pytest.mark.asyncio
async def test_deal_move_to_won_sets_status_and_close(db_session, vid, default_pipeline):
    svc = DealService(db_session)
    stage = _first_stage(default_pipeline)
    deal = await svc.create(vid, DealCreate(title="Win Me", pipeline_id=default_pipeline.id,
                                            stage_id=stage.id, amount=Decimal("5000")))
    won = _won_stage(default_pipeline)
    moved = await svc.move(vid, deal.id, DealMoveRequest(stage_id=won.id))
    assert moved.status == "won"
    assert moved.closed_at is not None


@pytest.mark.asyncio
async def test_deal_update_status_won_sets_closed_at(db_session, vid, default_pipeline):
    svc = DealService(db_session)
    stage = _first_stage(default_pipeline)
    deal = await svc.create(vid, DealCreate(title="Update Win", pipeline_id=default_pipeline.id,
                                            stage_id=stage.id))
    updated = await svc.update(vid, deal.id, DealUpdate(status="won"))
    assert updated.status == "won" and updated.closed_at is not None


@pytest.mark.asyncio
async def test_deal_forecast_weighted(db_session, vid, default_pipeline):
    svc = DealService(db_session)
    stage = _first_stage(default_pipeline)  # Prospect, 10%
    await svc.create(vid, DealCreate(title="F1", pipeline_id=default_pipeline.id,
                                     stage_id=stage.id, amount=Decimal("10000"),
                                     probability=Decimal(50)))
    forecast = await svc.forecast(vid, default_pipeline.id)
    assert forecast["unweighted_total"] == 10000.0
    assert forecast["weighted_total"] == 5000.0  # 10000 * 50%


@pytest.mark.asyncio
async def test_deal_delete(db_session, vid, default_pipeline):
    svc = DealService(db_session)
    stage = _first_stage(default_pipeline)
    deal = await svc.create(vid, DealCreate(title="Temp", pipeline_id=default_pipeline.id,
                                            stage_id=stage.id))
    await svc.delete(vid, deal.id)
    with pytest.raises(Exception):
        await svc.get(vid, deal.id)


# ══════════════════════════════════════════════════════════════════════════════
# ACTIVITIES
# ══════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_activity_create_defaults_owner_to_actor(db_session, vid, actor):
    svc = ActivityService(db_session)
    act = await svc.create(vid, ActivityCreate(type="task", subject="Follow up"), actor_id=actor)
    assert act.owner_id == actor


@pytest.mark.asyncio
async def test_activity_complete_sets_completed_at(db_session, vid, actor):
    svc = ActivityService(db_session)
    act = await svc.create(vid, ActivityCreate(type="call", subject="Discovery call"), actor_id=actor)
    done = await svc.complete(vid, act.id, outcome="connected", actor_id=actor)
    assert done.status == "completed" and done.completed_at is not None
    assert done.outcome == "connected"


@pytest.mark.asyncio
async def test_activity_update_to_completed_stamps_time(db_session, vid, actor):
    svc = ActivityService(db_session)
    act = await svc.create(vid, ActivityCreate(type="task", subject="Email proposal"), actor_id=actor)
    upd = await svc.update(vid, act.id, ActivityUpdate(status="completed"), actor_id=actor)
    assert upd.completed_at is not None


# ══════════════════════════════════════════════════════════════════════════════
# COMMUNICATIONS
# ══════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_communication_log_and_fetch_for_entity(db_session, vid, actor):
    contacts = ContactService(db_session)
    c = await contacts.create(vid, ContactCreate(first_name="Comm", email="comm@test.io"))
    svc = CommunicationService(db_session)
    await svc.log(vid, CommunicationCreate(channel="email", direction="outbound",
                                           subject="Hi", body="Hello",
                                           related_type="contact", related_id=c.id,
                                           contact_id=c.id), recorded_by=actor)
    items, total = await svc.for_entity(vid, "contact", c.id)
    assert total == 1 and items[0].subject == "Hi"


# ══════════════════════════════════════════════════════════════════════════════
# TICKETS / SLA / KB
# ══════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_ticket_number_increments(db_session, vid, actor):
    svc = TicketService(db_session)
    t1 = await svc.create(vid, TicketCreate(subject="Issue 1"), actor_id=actor)
    t2 = await svc.create(vid, TicketCreate(subject="Issue 2"), actor_id=actor)
    assert t1.number == "TCK-000001"
    assert t2.number == "TCK-000002"


@pytest.mark.asyncio
async def test_ticket_resolve_and_close_timestamps(db_session, vid, actor):
    svc = TicketService(db_session)
    t = await svc.create(vid, TicketCreate(subject="Broken"), actor_id=actor)
    resolved = await svc.update(vid, t.id, TicketUpdate(status="resolved"), actor_id=actor)
    assert resolved.resolved_at is not None
    closed = await svc.update(vid, t.id, TicketUpdate(status="closed"), actor_id=actor)
    assert closed.closed_at is not None


@pytest.mark.asyncio
async def test_ticket_public_comment_sets_first_response(db_session, vid, actor):
    svc = TicketService(db_session)
    t = await svc.create(vid, TicketCreate(subject="Need help"), actor_id=actor)
    await svc.add_comment(vid, t.id, TicketCommentCreate(body="On it", is_internal=False),
                          actor_id=actor)
    refreshed = await svc.get(vid, t.id)
    assert refreshed.first_response_at is not None
    comments = await svc.list_comments(vid, t.id)
    assert len(comments) == 1


@pytest.mark.asyncio
async def test_ticket_internal_comment_does_not_set_first_response(db_session, vid, actor):
    svc = TicketService(db_session)
    t = await svc.create(vid, TicketCreate(subject="Internal only"), actor_id=actor)
    await svc.add_comment(vid, t.id, TicketCommentCreate(body="note", is_internal=True),
                          actor_id=actor)
    refreshed = await svc.get(vid, t.id)
    assert refreshed.first_response_at is None


@pytest.mark.asyncio
async def test_sla_policy_create_list_delete(db_session, vid):
    svc = SlaPolicyService(db_session)
    p = await svc.create(vid, SlaPolicyCreate(name="Gold", response_target_minutes=60))
    assert p.id
    assert len(await svc.list(vid)) == 1
    await svc.delete(vid, p.id)
    assert len(await svc.list(vid)) == 0


@pytest.mark.asyncio
async def test_kb_article_slug_autogenerated(db_session, vid, actor):
    svc = KbService(db_session)
    art = await svc.create(vid, KbArticleCreate(title="How To Reset", slug="",
                                                body="steps", status="published"),
                           actor_id=actor)
    assert art.slug  # slugify falls back from title when slug blank
    upd = await svc.update(vid, art.id, KbArticleUpdate(status="archived"), actor_id=actor)
    assert upd.status == "archived"


# ══════════════════════════════════════════════════════════════════════════════
# MARKETING: segments, templates, campaigns
# ══════════════════════════════════════════════════════════════════════════════

@pytest_asyncio.fixture
async def two_customer_contacts(db_session, vid):
    svc = ContactService(db_session)
    await svc.create(vid, ContactCreate(first_name="Cust1", email="c1@seg.example.com",
                                        lifecycle_stage="customer"))
    await svc.create(vid, ContactCreate(first_name="Cust2", email="c2@seg.example.com",
                                        lifecycle_stage="customer"))
    await svc.create(vid, ContactCreate(first_name="LeadOnly", email="l1@seg.example.com",
                                        lifecycle_stage="lead"))


@pytest.mark.asyncio
async def test_segment_count_and_preview(db_session, vid, two_customer_contacts):
    svc = SegmentService(db_session)
    seg = await svc.create(vid, SegmentCreate(
        name="Customers",
        filter_dsl={"all": [{"field": "lifecycle_stage", "op": "eq", "value": "customer"}]},
    ))
    assert seg.contact_count == 2
    preview = await svc.preview(vid, seg.id)
    assert len(preview) == 2


@pytest.mark.asyncio
async def test_email_template_crud(db_session, vid):
    svc = EmailTemplateService(db_session)
    tpl = await svc.create(vid, EmailTemplateCreate(name="Welcome", subject="Hi {{name}}",
                                                    body_html="<p>Hello</p>"))
    assert tpl.id
    tpl = await svc.update(vid, tpl.id, EmailTemplateCreate(name="Welcome v2",
                                                            subject="Hi", body_html="<p>Hi</p>"))
    assert tpl.name == "Welcome v2"
    await svc.delete(vid, tpl.id)
    assert len(await svc.list(vid)) == 0


@pytest.mark.asyncio
async def test_campaign_create_with_steps_and_lifecycle(db_session, vid):
    svc = CampaignService(db_session)
    camp, steps = await svc.create(vid, CampaignCreate(
        name="Drip", type="drip",
        steps=[CampaignStepBase(sort_order=0, delay_minutes=0, channel="email"),
               CampaignStepBase(sort_order=1, delay_minutes=1440, channel="email")],
    ))
    assert len(steps) == 2
    started = await svc.start(vid, camp.id)
    assert started.status == "active" and started.started_at is not None
    paused = await svc.pause(vid, camp.id)
    assert paused.status == "paused"


@pytest.mark.asyncio
async def test_campaign_enroll_segment(db_session, vid, two_customer_contacts):
    seg_svc = SegmentService(db_session)
    seg = await seg_svc.create(vid, SegmentCreate(
        name="Customers",
        filter_dsl={"all": [{"field": "lifecycle_stage", "op": "eq", "value": "customer"}]},
    ))
    camp_svc = CampaignService(db_session)
    camp, _ = await camp_svc.create(vid, CampaignCreate(name="Blast"))
    enrolled = await camp_svc.enroll_segment(vid, camp.id, seg.id)
    assert enrolled == 2
    # Idempotent: enrolling again should add zero.
    again = await camp_svc.enroll_segment(vid, camp.id, seg.id)
    assert again == 0


# ══════════════════════════════════════════════════════════════════════════════
# WORKFLOWS
# ══════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_workflow_crud(db_session, vid):
    svc = WorkflowService(db_session)
    wf = await svc.create(vid, WorkflowCreate(
        name="Auto-assign",
        trigger={"event": "crm.lead.created"},
        steps=[{"action": "assign_round_robin"}],
    ))
    assert wf.status == "active"
    wf = await svc.update(vid, wf.id, WorkflowUpdate(status="paused"))
    assert wf.status == "paused"
    await svc.delete(vid, wf.id)
    assert len(await svc.list(vid)) == 0


# ══════════════════════════════════════════════════════════════════════════════
# INTEGRATIONS
# ══════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_integration_upsert_creates_then_updates(db_session, vid):
    svc = IntegrationService(db_session)
    created = await svc.upsert(vid, IntegrationCreate(provider="sendgrid", label="Email",
                                                      credentials={"api_key": "secret"}))
    assert created.status == "connected"
    assert created.encrypted_credentials  # credentials stored encrypted, not plaintext
    assert "secret" not in (created.encrypted_credentials or "")

    # Upserting same provider updates the existing row rather than duplicating.
    updated = await svc.upsert(vid, IntegrationCreate(provider="sendgrid", label="Email v2"))
    assert updated.id == created.id
    assert updated.label == "Email v2"
    assert len(await svc.list(vid)) == 1


@pytest.mark.asyncio
async def test_integration_update_and_delete(db_session, vid):
    svc = IntegrationService(db_session)
    obj = await svc.upsert(vid, IntegrationCreate(provider="twilio_sms"))
    obj = await svc.update(vid, obj.id, IntegrationUpdate(status="disconnected"))
    assert obj.status == "disconnected"
    await svc.delete(vid, obj.id)
    assert len(await svc.list(vid)) == 0


# ══════════════════════════════════════════════════════════════════════════════
# CHAT
# ══════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_chat_visitor_conversation_and_messages(db_session, vid, actor):
    svc = ChatService(db_session)
    conv = await svc.get_or_create_for_visitor(vid, "visitor-123", visitor_name="Guest")
    # Re-fetching the same visitor returns the same conversation.
    same = await svc.get_or_create_for_visitor(vid, "visitor-123")
    assert same.id == conv.id

    msg = await svc.post_message(vid, conv.id, sender="customer", body="Hello?")
    assert msg.body == "Hello?"

    agent_reply = await svc.post_message(vid, conv.id, sender="agent", body="Hi there",
                                         sender_id=actor)
    assert agent_reply.sender == "agent"

    full = await svc.get_conversation(vid, conv.id)
    assert len(full.messages) == 2
    assert full.status == "open"  # agent message reopens / keeps open

    closed = await svc.close(vid, conv.id)
    assert closed.status == "closed"


@pytest.mark.asyncio
async def test_chat_bot_reply_without_adapter_uses_fallback(db_session, vid):
    svc = ChatService(db_session)
    conv = await svc.get_or_create_for_visitor(vid, "visitor-bot")
    reply = await svc.bot_reply(vid, conv.id, "I have a question")
    assert reply is not None and reply.sender == "bot"
    assert reply.body  # canned fallback message


# ══════════════════════════════════════════════════════════════════════════════
# JOURNEY
# ══════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_journey_record_and_funnel(db_session, vid):
    contacts = ContactService(db_session)
    c = await contacts.create(vid, ContactCreate(first_name="Journey", email="j@test.io"))
    svc = JourneyService(db_session)
    await svc.record(vid, JourneyEventBase(event_type="page_view", contact_id=c.id))
    await svc.record(vid, JourneyEventBase(event_type="page_view", contact_id=c.id))
    await svc.record(vid, JourneyEventBase(event_type="add_to_cart", contact_id=c.id))

    items, total = await svc.for_contact(vid, c.id)
    assert total == 3

    funnel = await svc.funnel(vid, ["page_view", "add_to_cart", "purchase"])
    assert funnel == {"page_view": 2, "add_to_cart": 1, "purchase": 0}


# ══════════════════════════════════════════════════════════════════════════════
# AUDIT
# ══════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_audit_log_written_on_account_actions(db_session, vid, actor):
    accounts = AccountService(db_session)
    acc = await accounts.create(vid, AccountCreate(name="Audited"), actor_id=actor)
    await accounts.update(vid, acc.id, AccountUpdate(industry="logistics"), actor_id=actor)

    audit = AuditQueryService(db_session)
    items, total = await audit.list(vid, entity="crm_account")
    actions = {row.action for row in items}
    assert "create" in actions and "update" in actions


# ══════════════════════════════════════════════════════════════════════════════
# AI
# ══════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_ai_next_best_action_rule_fallback(db_session, vid):
    contacts = ContactService(db_session)
    c = await contacts.create(vid, ContactCreate(first_name="AI", email="ai@test.io"))
    svc = AiService(db_session)
    out = await svc.next_best_action(vid, c.id)
    assert out["ok"] is True
    assert out["suggestion"]


# ══════════════════════════════════════════════════════════════════════════════
# LEAD INTAKE TOKENS
# ══════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_intake_token_create_and_revoke(db_session, vid):
    svc = IntakeTokenService(db_session)
    tok = await svc.create(vid, IntakeTokenCreate(label="Website form"))
    assert tok.token and tok.is_active
    await svc.revoke(vid, tok.id)
    tokens = await svc.list(vid)
    assert tokens[0].is_active is False


# ══════════════════════════════════════════════════════════════════════════════
# REPORTS
# ══════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_report_overview_counts(db_session, vid, default_pipeline):
    contacts = ContactService(db_session)
    await contacts.create(vid, ContactCreate(first_name="R1", email="r1@rep.example.com"))
    deals = DealService(db_session)
    stage = _first_stage(default_pipeline)
    won = _won_stage(default_pipeline)
    await deals.create(vid, DealCreate(title="Open deal", pipeline_id=default_pipeline.id,
                                       stage_id=stage.id, amount=Decimal("1000")))
    won_deal = await deals.create(vid, DealCreate(title="Won deal", pipeline_id=default_pipeline.id,
                                                  stage_id=stage.id, amount=Decimal("3000")))
    await deals.move(vid, won_deal.id, DealMoveRequest(stage_id=won.id))

    report = await ReportService(db_session).overview(vid)
    assert report["contacts"] == 1
    assert report["deals_open"] == 1
    assert report["deals_won"] == 1
    assert report["won_total"] == 3000.0


@pytest.mark.asyncio
async def test_report_ticket_performance(db_session, vid, actor):
    tickets = TicketService(db_session)
    t = await tickets.create(vid, TicketCreate(subject="P1"), actor_id=actor)
    await tickets.update(vid, t.id, TicketUpdate(status="resolved"), actor_id=actor)
    await tickets.create(vid, TicketCreate(subject="P2"), actor_id=actor)

    report = await ReportService(db_session).ticket_performance(vid)
    assert report["by_status"].get("resolved") == 1
    assert report["by_status"].get("open") == 1


# ══════════════════════════════════════════════════════════════════════════════
# RECENT FEATURES (contact merge, custom fields, care notifications)
# ══════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_contact_company_syncs_linked_account(db_session, vid, actor):
    svc = ContactService(db_session)
    co = await svc.create(
        vid,
        ContactCreate(
            first_name="Hyderabad Corp",
            record_type="company",
            industry="IT",
            region="Hyderabad",
        ),
        actor_id=actor,
    )
    assert co.record_type == "company"
    assert co.linked_account_id is not None
    acc = await AccountService(db_session).get(vid, co.linked_account_id)
    assert acc.name == "Hyderabad Corp"
    assert acc.industry == "IT"


@pytest.mark.asyncio
async def test_activity_custom_fields_persist(db_session, vid, actor):
    svc = ActivityService(db_session)
    act = await svc.create(
        vid,
        ActivityCreate(
            subject="Follow up call",
            type="task",
            custom_fields={"priority": "high", "ref": "TSK-001"},
        ),
        actor_id=actor,
    )
    fetched = await svc.get(vid, act.id)
    assert fetched.custom_fields.get("priority") == "high"
    assert fetched.custom_fields.get("ref") == "TSK-001"


@pytest.mark.asyncio
async def test_report_overview_range_includes_trends(db_session, vid):
    report = await ReportService(db_session).overview(vid, range_key="3m")
    assert "trends" in report
    assert "contacts_companies" in report["trends"]
    assert "total_contacts" in report
    assert "pipeline_value" in report


@pytest.mark.asyncio
async def test_segment_create_update_delete(db_session, vid):
    svc = SegmentService(db_session)
    seg = await svc.create(
        vid,
        SegmentCreate(
            name="Hyderabad",
            description="Hyderabad Based Customers",
            filter_dsl={"all": [
                {"field": "phone", "op": "eq", "value": "+91"},
                {"field": "lifecycle_stage", "op": "eq", "value": "customer"},
            ]},
        ),
    )
    assert seg.id and seg.name == "Hyderabad"
    upd = await svc.update(vid, seg.id, SegmentCreate(name="Hyderabad Updated"))
    assert upd.name == "Hyderabad Updated"
    await svc.delete(vid, seg.id)
    items = await svc.list(vid)
    assert not any(s.id == seg.id for s in items)


@pytest.mark.asyncio
async def test_customer_care_notification_in_app(db_session, vid):
    from app.models.customer import Customer
    from app.services.notification_service import NotificationService

    cust = Customer(
        id=uuid.uuid4(),
        vendor_id=vid,
        full_name="Priya Nair",
        email="priya@nair.com",
        phone="+919876500004",
        password_hash="test-hash",
    )
    db_session.add(cust)
    await db_session.flush()

    svc = NotificationService(db_session)
    notif = await svc.notify_care_reminder(
        vendor_id=vid,
        customer_id=cust.id,
        title="Medicine reminder",
        message="Take your medicine today at noon",
        include_reach_back=True,
        reference_id="r-test-001",
    )
    await db_session.commit()

    assert notif.type == "care_reminder"
    assert notif.channel == "in_app"
    items = await svc.get_customer_notifications(vid, cust.id)
    assert len(items) >= 1
    assert items[0].title == "Medicine reminder"
    assert items[0].data.get("include_reach_back") is True


# ══════════════════════════════════════════════════════════════════════════════
# TENANT ISOLATION (negative paths)
# ══════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_contact_not_visible_to_other_vendor(db_session, vid):
    svc = ContactService(db_session)
    c = await svc.create(vid, ContactCreate(first_name="Private"))
    with pytest.raises(Exception) as exc:
        await svc.get(uuid.uuid4(), c.id)
    assert "not found" in str(getattr(exc.value, "detail", exc.value)).lower()


@pytest.mark.asyncio
async def test_deal_not_visible_to_other_vendor(db_session, vid, default_pipeline):
    svc = DealService(db_session)
    stage = _first_stage(default_pipeline)
    deal = await svc.create(vid, DealCreate(title="Secret", pipeline_id=default_pipeline.id,
                                            stage_id=stage.id))
    with pytest.raises(Exception):
        await svc.get(uuid.uuid4(), deal.id)


@pytest.mark.asyncio
async def test_ticket_not_visible_to_other_vendor(db_session, vid, actor):
    svc = TicketService(db_session)
    t = await svc.create(vid, TicketCreate(subject="Hidden"), actor_id=actor)
    with pytest.raises(Exception):
        await svc.get(uuid.uuid4(), t.id)
