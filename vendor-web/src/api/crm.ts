import { apiClient } from './client'

const BASE = '/vendors/me/crm'

export type Paginated<T> = {
  items: T[]
  total: number
  page: number
  size: number
  pages: number
}

export type Account = {
  id: string
  vendor_id: string
  number: string
  name: string
  industry?: string | null
  region?: string | null
  website?: string | null
  phone?: string | null
  email?: string | null
  annual_revenue?: number | null
  employee_count?: number | null
  parent_id?: string | null
  owner_id?: string | null
  tags?: string[] | null
  notes?: string | null
  custom_fields?: Record<string, unknown> | null
  is_active?: boolean
  created_at: string
  updated_at: string
}

export type Contact = {
  id: string
  vendor_id: string
  record_type?: 'person' | 'company' | string | null
  salutation?: string | null
  first_name: string
  last_name?: string | null
  title?: string | null
  email?: string | null
  phone?: string | null
  mobile?: string | null
  industry?: string | null
  region?: string | null
  website?: string | null
  annual_revenue?: number | null
  employee_count?: number | null
  account_id?: string | null
  parent_contact_id?: string | null
  linked_account_id?: string | null
  number?: string | null
  owner_id?: string | null
  lifecycle_stage?: string | null
  lead_source?: string | null
  tags?: string[] | null
  notes?: string | null
  address?: Record<string, unknown> | null
  custom_fields?: Record<string, unknown> | null
  do_not_email?: boolean
  do_not_call?: boolean
  is_active?: boolean
  last_activity_at?: string | null
  created_at: string
  updated_at: string
}

export type Lead = {
  id: string
  vendor_id: string
  number: string
  first_name?: string | null
  last_name?: string | null
  company?: string | null
  email?: string | null
  phone?: string | null
  title?: string | null
  source?: string | null
  status?: string | null
  score?: number | null
  rating?: string | null
  assigned_to?: string | null
  notes?: string | null
  tags?: string[] | null
  converted_at?: string | null
  converted_contact_id?: string | null
  converted_account_id?: string | null
  converted_deal_id?: string | null
  created_at: string
  updated_at: string
}

export type Stage = {
  id: string
  pipeline_id: string
  name: string
  probability: number
  sort_order: number
  is_won: boolean
  is_lost: boolean
  color?: string | null
}

export type Pipeline = {
  id: string
  name: string
  description?: string | null
  is_default: boolean
  is_active: boolean
  sort_order: number
  stages: Stage[]
  created_at: string
  updated_at: string
}

export type Deal = {
  id: string
  vendor_id: string
  number: string
  title: string
  description?: string | null
  pipeline_id: string
  stage_id: string
  account_id?: string | null
  contact_id?: string | null
  owner_id?: string | null
  amount: number
  currency: string
  probability?: number | null
  expected_close_date?: string | null
  status: string
  source?: string | null
  sort_order: number
  closed_at?: string | null
  lost_reason?: string | null
  won_reason?: string | null
  tags?: string[] | null
  custom_fields?: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export type Activity = {
  id: string
  vendor_id: string
  number: string
  type: string
  subject: string
  description?: string | null
  related_type?: string | null
  related_id?: string | null
  due_at?: string | null
  reminder_at?: string | null
  duration_minutes?: number | null
  priority?: string | null
  status?: string | null
  location?: string | null
  meeting_url?: string | null
  outcome?: string | null
  owner_id?: string | null
  custom_fields?: Record<string, unknown> | null
  completed_at?: string | null
  created_at: string
  updated_at: string
}

export type Communication = {
  id: string
  channel: string
  direction: string
  subject?: string | null
  body?: string | null
  occurred_at: string
  related_type?: string | null
  related_id?: string | null
  contact_id?: string | null
  provider?: string | null
  status?: string | null
  external_id?: string | null
}

export type Ticket = {
  id: string
  number: string
  subject: string
  description?: string | null
  contact_id?: string | null
  account_id?: string | null
  assigned_to?: string | null
  sla_policy_id?: string | null
  priority: string
  status: string
  source: string
  first_response_at?: string | null
  resolved_at?: string | null
  closed_at?: string | null
  sla_breached: boolean
  tags?: string[] | null
  custom_fields?: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export type TicketComment = {
  id: string
  ticket_id: string
  author_id?: string | null
  contact_id?: string | null
  body: string
  is_internal: boolean
  attachments: Record<string, unknown>[]
  created_at: string
}

export type SlaPolicy = {
  id: string
  name: string
  description?: string | null
  priority: string
  response_target_minutes: number
  resolution_target_minutes: number
  business_hours?: Record<string, unknown> | null
  is_active: boolean
  created_at: string
}

export type KbArticle = {
  id: string
  title: string
  slug: string
  body?: string | null
  summary?: string | null
  tags?: string[] | null
  status: string
  view_count: number
  helpful_count: number
  author_id?: string | null
  created_at: string
  updated_at: string
}

export type Segment = {
  id: string
  name: string
  description?: string | null
  filter_dsl?: Record<string, unknown> | null
  is_active: boolean
  contact_count: number
  last_computed_at?: string | null
  created_at: string
  updated_at: string
}

export type TemplateAttachment = {
  url: string
  type: 'image' | 'video' | string
  name?: string | null
  is_header?: boolean
}

export type TemplateSettings = {
  cta_label?: string
  cta_url?: string
  footer_text?: string
}

export type EmailTemplate = {
  id: string
  name: string
  subject: string
  body_html: string
  body_text?: string | null
  merge_tags?: string[] | null
  channel?: string
  description?: string | null
  attachments?: TemplateAttachment[] | null
  settings?: TemplateSettings | null
  schedule_start?: string | null
  schedule_end?: string | null
  /** @deprecated use schedule_start */
  scheduled_at?: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type CampaignStep = {
  id: string
  campaign_id: string
  sort_order: number
  delay_minutes: number
  channel: string
  template_id?: string | null
  condition?: Record<string, unknown> | null
  action?: Record<string, unknown> | null
}

export type Campaign = {
  id: string
  name: string
  type: string
  channel: string
  status: string
  template_id?: string | null
  segment_id?: string | null
  scheduled_at?: string | null
  settings?: Record<string, unknown> | null
  started_at?: string | null
  completed_at?: string | null
  sent_count: number
  open_count: number
  click_count: number
  bounce_count: number
  unsubscribe_count: number
  steps: CampaignStep[]
  created_at: string
  updated_at: string
}

export type Workflow = {
  id: string
  name: string
  description?: string | null
  trigger: Record<string, unknown>
  steps: Record<string, unknown>[]
  status: string
  requires_approval: boolean
  last_run_at?: string | null
  run_count: number
  success_count: number
  failure_count: number
  created_at: string
  updated_at: string
}

export type WorkflowRun = {
  id: string
  workflow_id: string
  entity_type?: string | null
  entity_id?: string | null
  status: string
  log: Record<string, unknown>[]
  error?: string | null
  started_at: string
  finished_at?: string | null
}

export type Integration = {
  id: string
  provider: string
  label?: string | null
  status: string
  settings: Record<string, unknown>
  last_synced_at?: string | null
  last_error?: string | null
  created_at: string
  updated_at: string
}

export type AiInsight = {
  id: string
  entity_type: string
  entity_id: string
  kind: string
  content: Record<string, unknown>
  model?: string | null
  confidence?: number | null
  generated_at: string
  expires_at?: string | null
}

export type AuditLog = {
  id: string
  actor_id?: string | null
  actor_type: string
  entity: string
  entity_id?: string | null
  action: string
  before?: unknown
  after?: unknown
  ip?: string | null
  user_agent?: string | null
  request_path?: string | null
  created_at: string
}

export type ChatConversation = {
  id: string
  contact_id?: string | null
  customer_id?: string | null
  visitor_id?: string | null
  visitor_name?: string | null
  visitor_email?: string | null
  channel: string
  status: string
  assigned_to?: string | null
  bot_handled: boolean
  last_message_at: string
  created_at: string
}

export type ChatMessage = {
  id: string
  conversation_id: string
  sender: string
  sender_id?: string | null
  body?: string | null
  attachments: Record<string, unknown>[]
  created_at: string
}

export type IntakeToken = {
  id: string
  token: string
  label?: string | null
  source_default: string
  is_active: boolean
  created_at: string
  last_used_at?: string | null
}

export type JourneyEvent = {
  id: string
  event_type: string
  payload?: Record<string, unknown> | null
  contact_id?: string | null
  customer_id?: string | null
  visitor_id?: string | null
  occurred_at: string
}

// ── API helpers ─────────────────────────────────────────────────────────────

export type CrmDocument = {
  url: string
  filename: string
  content_type?: string
  size?: number
  is_image?: boolean
}

export const crmApi = {
  // Attachments (contact / account documents)
  uploadDocument: async (file: File): Promise<CrmDocument> => {
    const form = new FormData()
    form.append('file', file)
    const r = await apiClient.post<CrmDocument>('/uploads/crm/document', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return r.data
  },

  uploadTemplateMedia: async (file: File): Promise<TemplateAttachment> => {
    const form = new FormData()
    form.append('file', file)
    const r = await apiClient.post<TemplateAttachment>('/uploads/crm/template-media', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return r.data
  },

  // Accounts
  listAccounts: (params: Record<string, unknown> = {}) =>
    apiClient.get<Paginated<Account>>(`${BASE}/accounts`, { params }).then(r => r.data),
  getAccount: (id: string) => apiClient.get<Account>(`${BASE}/accounts/${id}`).then(r => r.data),
  createAccount: (data: Partial<Account>) => apiClient.post<Account>(`${BASE}/accounts`, data).then(r => r.data),
  updateAccount: (id: string, data: Partial<Account>) =>
    apiClient.put<Account>(`${BASE}/accounts/${id}`, data).then(r => r.data),
  deleteAccount: (id: string) => apiClient.delete(`${BASE}/accounts/${id}`),

  // Contacts
  listContacts: (params: Record<string, unknown> = {}) =>
    apiClient.get<Paginated<Contact>>(`${BASE}/contacts`, { params }).then(r => r.data),
  getContact: (id: string) => apiClient.get<Contact>(`${BASE}/contacts/${id}`).then(r => r.data),
  createContact: (data: Partial<Contact>) => apiClient.post<Contact>(`${BASE}/contacts`, data).then(r => r.data),
  updateContact: (id: string, data: Partial<Contact>) =>
    apiClient.put<Contact>(`${BASE}/contacts/${id}`, data).then(r => r.data),
  deleteContact: (id: string) => apiClient.delete(`${BASE}/contacts/${id}`),

  // Leads
  listLeads: (params: Record<string, unknown> = {}) =>
    apiClient.get<Paginated<Lead>>(`${BASE}/leads`, { params }).then(r => r.data),
  getLead: (id: string) => apiClient.get<Lead>(`${BASE}/leads/${id}`).then(r => r.data),
  createLead: (data: Partial<Lead>) => apiClient.post<Lead>(`${BASE}/leads`, data).then(r => r.data),
  updateLead: (id: string, data: Partial<Lead>) =>
    apiClient.put<Lead>(`${BASE}/leads/${id}`, data).then(r => r.data),
  deleteLead: (id: string) => apiClient.delete(`${BASE}/leads/${id}`),
  assignLead: (id: string, user_id: string) =>
    apiClient.post(`${BASE}/leads/${id}/assign`, { user_id }).then(r => r.data),
  convertLead: (id: string, payload: Record<string, unknown>) =>
    apiClient.post(`${BASE}/leads/${id}/convert`, payload).then(r => r.data),
  scoreLead: (id: string) => apiClient.post(`${BASE}/leads/${id}/score`).then(r => r.data),

  // Pipelines
  listPipelines: () => apiClient.get<Pipeline[]>(`${BASE}/pipelines`).then(r => r.data),
  getPipeline: (id: string) => apiClient.get<Pipeline>(`${BASE}/pipelines/${id}`).then(r => r.data),
  createPipeline: (data: Partial<Pipeline> & { stages?: Partial<Stage>[] }) =>
    apiClient.post<Pipeline>(`${BASE}/pipelines`, data).then(r => r.data),
  deletePipeline: (id: string) => apiClient.delete(`${BASE}/pipelines/${id}`),
  addStage: (pipelineId: string, data: Partial<Stage>) =>
    apiClient.post<Stage>(`${BASE}/pipelines/${pipelineId}/stages`, data).then(r => r.data),
  removeStage: (stageId: string) => apiClient.delete(`${BASE}/pipelines/stages/${stageId}`),

  // Deals
  listDeals: (params: Record<string, unknown> = {}) =>
    apiClient.get<Paginated<Deal>>(`${BASE}/deals`, { params }).then(r => r.data),
  getDeal: (id: string) => apiClient.get<Deal>(`${BASE}/deals/${id}`).then(r => r.data),
  createDeal: (data: Partial<Deal>) => apiClient.post<Deal>(`${BASE}/deals`, data).then(r => r.data),
  updateDeal: (id: string, data: Partial<Deal>) =>
    apiClient.put<Deal>(`${BASE}/deals/${id}`, data).then(r => r.data),
  moveDeal: (id: string, payload: { stage_id: string; sort_order?: number }) =>
    apiClient.post<Deal>(`${BASE}/deals/${id}/move`, payload).then(r => r.data),
  deleteDeal: (id: string) => apiClient.delete(`${BASE}/deals/${id}`),
  kanban: (params: { pipeline_id?: string; status?: string } = {}) =>
    apiClient.get<{ pipeline: Pipeline; columns: { stage: Stage; deals: Deal[] }[] }>(`${BASE}/deals/kanban`, { params }).then(r => r.data),
  forecast: (params: { pipeline_id?: string } = {}) =>
    apiClient.get(`${BASE}/deals/forecast`, { params }).then(r => r.data),

  // Activities
  listActivities: (params: Record<string, unknown> = {}) =>
    apiClient.get<Paginated<Activity>>(`${BASE}/activities`, { params }).then(r => r.data),
  getActivity: (id: string) => apiClient.get<Activity>(`${BASE}/activities/${id}`).then(r => r.data),
  createActivity: (data: Partial<Activity>) =>
    apiClient.post<Activity>(`${BASE}/activities`, data).then(r => r.data),
  updateActivity: (id: string, data: Partial<Activity>) =>
    apiClient.put<Activity>(`${BASE}/activities/${id}`, data).then(r => r.data),
  completeActivity: (id: string, outcome?: string) =>
    apiClient.post<Activity>(`${BASE}/activities/${id}/complete`, { outcome }).then(r => r.data),
  deleteActivity: (id: string) => apiClient.delete(`${BASE}/activities/${id}`),

  // Communications
  listCommunications: (params: Record<string, unknown> = {}) =>
    apiClient.get<Paginated<Communication>>(`${BASE}/communications`, { params }).then(r => r.data),
  logCommunication: (data: Partial<Communication> & { channel: string }) =>
    apiClient.post<Communication>(`${BASE}/communications`, data).then(r => r.data),
  sendEmail: (data: { contact_id: string; subject: string; body_html: string; body_text?: string }) =>
    apiClient.post(`${BASE}/communications/email`, data).then(r => r.data),
  sendSms: (data: { contact_id?: string; to_phone?: string; body: string }) =>
    apiClient.post(`${BASE}/communications/sms`, data).then(r => r.data),
  sendWhatsapp: (data: { contact_id?: string; to_phone?: string; body: string }) =>
    apiClient.post(`${BASE}/communications/whatsapp`, data).then(r => r.data),
  clickToCall: (data: { contact_id?: string; to_phone?: string; twiml_url?: string }) =>
    apiClient.post(`${BASE}/communications/call`, data).then(r => r.data),

  // Tickets
  listTickets: (params: Record<string, unknown> = {}) =>
    apiClient.get<Paginated<Ticket>>(`${BASE}/tickets`, { params }).then(r => r.data),
  getTicket: (id: string) => apiClient.get<Ticket>(`${BASE}/tickets/${id}`).then(r => r.data),
  createTicket: (data: Partial<Ticket>) => apiClient.post<Ticket>(`${BASE}/tickets`, data).then(r => r.data),
  updateTicket: (id: string, data: Partial<Ticket>) =>
    apiClient.put<Ticket>(`${BASE}/tickets/${id}`, data).then(r => r.data),
  listTicketComments: (id: string) =>
    apiClient.get<TicketComment[]>(`${BASE}/tickets/${id}/comments`).then(r => r.data),
  addTicketComment: (id: string, data: { body: string; is_internal?: boolean }) =>
    apiClient.post<TicketComment>(`${BASE}/tickets/${id}/comments`, data).then(r => r.data),

  // SLA
  listSla: () => apiClient.get<SlaPolicy[]>(`${BASE}/sla-policies`).then(r => r.data),
  createSla: (data: Partial<SlaPolicy>) =>
    apiClient.post<SlaPolicy>(`${BASE}/sla-policies`, data).then(r => r.data),
  deleteSla: (id: string) => apiClient.delete(`${BASE}/sla-policies/${id}`),

  // KB
  listKb: (params: Record<string, unknown> = {}) =>
    apiClient.get<Paginated<KbArticle>>(`${BASE}/kb`, { params }).then(r => r.data),
  getKb: (id: string) => apiClient.get<KbArticle>(`${BASE}/kb/${id}`).then(r => r.data),
  createKb: (data: Partial<KbArticle>) => apiClient.post<KbArticle>(`${BASE}/kb`, data).then(r => r.data),
  updateKb: (id: string, data: Partial<KbArticle>) =>
    apiClient.put<KbArticle>(`${BASE}/kb/${id}`, data).then(r => r.data),
  deleteKb: (id: string) => apiClient.delete(`${BASE}/kb/${id}`),

  // Segments
  listSegments: () => apiClient.get<Segment[]>(`${BASE}/segments`).then(r => r.data),
  getSegment: (id: string) => apiClient.get<Segment>(`${BASE}/segments/${id}`).then(r => r.data),
  createSegment: (data: Partial<Segment>) =>
    apiClient.post<Segment>(`${BASE}/segments`, data).then(r => r.data),
  updateSegment: (id: string, data: Partial<Segment>) =>
    apiClient.put<Segment>(`${BASE}/segments/${id}`, data).then(r => r.data),
  deleteSegment: (id: string) => apiClient.delete(`${BASE}/segments/${id}`),
  refreshSegment: (id: string) => apiClient.post(`${BASE}/segments/${id}/refresh`).then(r => r.data),
  previewSegment: (id: string, limit = 25) =>
    apiClient.get<Contact[]>(`${BASE}/segments/${id}/preview`, { params: { limit } }).then(r => r.data),

  // Templates
  listTemplates: () => apiClient.get<EmailTemplate[]>(`${BASE}/templates`).then(r => r.data),
  createTemplate: (data: Partial<EmailTemplate>) =>
    apiClient.post<EmailTemplate>(`${BASE}/templates`, data).then(r => r.data),
  updateTemplate: (id: string, data: Partial<EmailTemplate>) =>
    apiClient.put<EmailTemplate>(`${BASE}/templates/${id}`, data).then(r => r.data),
  deleteTemplate: (id: string) => apiClient.delete(`${BASE}/templates/${id}`),
  testTemplate: (id: string, data: { channel?: string; test_phone?: string; test_email?: string }) =>
    apiClient.post<{ ok: boolean; message: string }>(`${BASE}/templates/${id}/test`, data, { timeout: 60000 }).then(r => r.data),

  // Campaigns
  getCampaignAudiencePreview: (params: { channel?: string; segment_id?: string; limit?: number } = {}) =>
    apiClient.get<{ total: number; contacts: Contact[] }>(`${BASE}/campaigns/audience-preview`, { params }).then(r => r.data),
  listCampaigns: (params: Record<string, unknown> = {}) =>
    apiClient.get<Paginated<Campaign>>(`${BASE}/campaigns`, { params }).then(r => r.data),
  getCampaign: (id: string) => apiClient.get<Campaign>(`${BASE}/campaigns/${id}`).then(r => r.data),
  createCampaign: (data: Partial<Campaign> & { steps?: Partial<CampaignStep>[] }) =>
    apiClient.post<Campaign>(`${BASE}/campaigns`, data).then(r => r.data),
  updateCampaign: (id: string, data: Partial<Campaign>) =>
    apiClient.put<Campaign>(`${BASE}/campaigns/${id}`, data).then(r => r.data),
  deleteCampaign: (id: string) => apiClient.delete(`${BASE}/campaigns/${id}`),
  startCampaign: (id: string) => apiClient.post(`${BASE}/campaigns/${id}/start`).then(r => r.data),
  pauseCampaign: (id: string) => apiClient.post(`${BASE}/campaigns/${id}/pause`).then(r => r.data),
  enrollSegment: (campaignId: string, segmentId: string) =>
    apiClient.post(`${BASE}/campaigns/${campaignId}/enroll-segment/${segmentId}`).then(r => r.data),

  // Workflows
  listWorkflows: () => apiClient.get<Workflow[]>(`${BASE}/workflows`).then(r => r.data),
  getWorkflow: (id: string) => apiClient.get<Workflow>(`${BASE}/workflows/${id}`).then(r => r.data),
  createWorkflow: (data: Partial<Workflow>) =>
    apiClient.post<Workflow>(`${BASE}/workflows`, data).then(r => r.data),
  updateWorkflow: (id: string, data: Partial<Workflow>) =>
    apiClient.put<Workflow>(`${BASE}/workflows/${id}`, data).then(r => r.data),
  deleteWorkflow: (id: string) => apiClient.delete(`${BASE}/workflows/${id}`),
  listWorkflowRuns: (id: string, params: Record<string, unknown> = {}) =>
    apiClient.get<Paginated<WorkflowRun>>(`${BASE}/workflows/${id}/runs`, { params }).then(r => r.data),
  triggerWorkflow: (id: string, payload: { entity_type: string; entity_id: string; context?: Record<string, unknown> }) =>
    apiClient.post(`${BASE}/workflows/${id}/trigger`, payload).then(r => r.data),

  // Integrations
  listIntegrations: () => apiClient.get<Integration[]>(`${BASE}/integrations`).then(r => r.data),
  getIntegrationForm: (id: string) =>
    apiClient.get<{
      id: string
      provider: string
      label?: string | null
      status: string
      settings: Record<string, string>
      credentials: Record<string, string>
      stored_secrets: string[]
      webhook_url?: string | null
    }>(`${BASE}/integrations/${id}/form`).then(r => r.data),
  getIntegrationDefaults: (provider: string) =>
    apiClient.get<{
      provider: string
      configured: boolean
      credentials: Record<string, string>
      settings: Record<string, string>
      key_source?: string | null
      webhook_url?: string | null
      webhook_events?: string[] | null
    }>(`${BASE}/integrations/defaults`, { params: { provider } }).then(r => r.data),
  upsertIntegration: (data: { provider: string; label?: string; settings?: Record<string, unknown>; credentials?: Record<string, unknown> }) =>
    apiClient.post<Integration>(`${BASE}/integrations`, data).then(r => r.data),
  updateIntegration: (id: string, data: Partial<Integration> & { credentials?: Record<string, unknown> }) =>
    apiClient.put<Integration>(`${BASE}/integrations/${id}`, data).then(r => r.data),
  deleteIntegration: (id: string) => apiClient.delete(`${BASE}/integrations/${id}`),
  setIntegrationCheckoutActive: (id: string, checkout_active: boolean) =>
    apiClient.patch<Integration>(`${BASE}/integrations/${id}/checkout-active`, { checkout_active }).then(r => r.data),
  testIntegration: (data: {
    provider: string
    credentials?: Record<string, unknown>
    settings?: Record<string, unknown>
    test_email?: string
    test_phone?: string
    integration_id?: string
  }) => apiClient.post<{ ok: boolean; message: string }>(`${BASE}/integrations/test`, data, { timeout: 60000 }).then(r => r.data),

  // Reports
  reportOverview: (params: { range?: string } = {}) =>
    apiClient.get(`${BASE}/reports/overview`, { params }).then(r => r.data),
  reportSales: () => apiClient.get(`${BASE}/reports/sales-performance`).then(r => r.data),
  reportCampaigns: () => apiClient.get(`${BASE}/reports/campaigns`).then(r => r.data),
  reportTickets: () => apiClient.get(`${BASE}/reports/tickets`).then(r => r.data),
  reportFunnel: (events?: string) =>
    apiClient.get(`${BASE}/reports/funnel`, { params: events ? { events } : {} }).then(r => r.data),

  // AI
  listInsights: (entityType: string, entityId: string, kind?: string) =>
    apiClient.get<AiInsight[]>(`${BASE}/ai/insights/${entityType}/${entityId}`, { params: kind ? { kind } : {} }).then(r => r.data),
  aiSummarise: (entityType: string, entityId: string) =>
    apiClient.post(`${BASE}/ai/summarise/${entityType}/${entityId}`).then(r => r.data),
  aiNextBest: (contactId: string) =>
    apiClient.post(`${BASE}/ai/next-best-action/${contactId}`).then(r => r.data),

  // Audit
  listAudit: (params: Record<string, unknown> = {}) =>
    apiClient.get<Paginated<AuditLog>>(`${BASE}/audit`, { params }).then(r => r.data),

  // Journey
  listJourney: (contactId: string, params: Record<string, unknown> = {}) =>
    apiClient.get<Paginated<JourneyEvent>>(`${BASE}/journey/${contactId}`, { params }).then(r => r.data),
  recordJourney: (data: Partial<JourneyEvent>) =>
    apiClient.post<JourneyEvent>(`${BASE}/journey`, data).then(r => r.data),

  // Chat
  listConversations: (params: Record<string, unknown> = {}) =>
    apiClient.get<Paginated<ChatConversation>>(`${BASE}/chat/conversations`, { params }).then(r => r.data),
  getConversation: (id: string) =>
    apiClient.get<{ conversation: ChatConversation; messages: ChatMessage[] }>(`${BASE}/chat/conversations/${id}`).then(r => r.data),
  postMessage: (id: string, body: string) =>
    apiClient.post<ChatMessage>(`${BASE}/chat/conversations/${id}/messages`, { body }).then(r => r.data),
  assignConversation: (id: string, user_id?: string) =>
    apiClient.post(`${BASE}/chat/conversations/${id}/assign`, user_id ? { user_id } : {}).then(r => r.data),
  closeConversation: (id: string) =>
    apiClient.post(`${BASE}/chat/conversations/${id}/close`).then(r => r.data),

  // Intake tokens
  listIntakeTokens: () => apiClient.get<IntakeToken[]>(`${BASE}/intake-tokens`).then(r => r.data),
  createIntakeToken: (data: { label: string; source_default?: string }) =>
    apiClient.post<IntakeToken>(`${BASE}/intake-tokens`, data).then(r => r.data),
  revokeIntakeToken: (id: string) =>
    apiClient.post(`${BASE}/intake-tokens/${id}/revoke`).then(r => r.data),
}
