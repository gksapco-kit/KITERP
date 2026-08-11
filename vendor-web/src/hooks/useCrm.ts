import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { crmApi } from '@/api/crm'
import { isAxiosAuthError } from '@/lib/errorMessages'

const KEY = (...parts: (string | number | undefined | Record<string, unknown>)[]) =>
  ['crm', ...parts] as const

// Accounts
export const useAccounts = (params: Record<string, unknown> = {}) =>
  useQuery({ queryKey: KEY('accounts', params), queryFn: () => crmApi.listAccounts(params) })

export const useAccount = (id?: string) =>
  useQuery({ queryKey: KEY('account', id), queryFn: () => crmApi.getAccount(id!), enabled: !!id })

export const useSaveAccount = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id?: string; data: Record<string, unknown> }) =>
      id ? crmApi.updateAccount(id, data) : crmApi.createAccount(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'accounts'] }),
  })
}

// Contacts
export const useContacts = (params: Record<string, unknown> = {}) =>
  useQuery({ queryKey: KEY('contacts', params), queryFn: () => crmApi.listContacts(params) })

export const useContact = (id?: string) =>
  useQuery({ queryKey: KEY('contact', id), queryFn: () => crmApi.getContact(id!), enabled: !!id })

export const useSaveContact = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id?: string; data: Record<string, unknown> }) =>
      id ? crmApi.updateContact(id, data) : crmApi.createContact(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'contacts'] }),
  })
}

// Leads
export const useLeads = (params: Record<string, unknown> = {}) =>
  useQuery({ queryKey: KEY('leads', params), queryFn: () => crmApi.listLeads(params) })

/** Count of CRM leads still in `new` status (sidebar badge on Leads). */
export const useNewLeadCount = (enabled = true) =>
  useQuery({
    queryKey: KEY('leads', 'new-count'),
    queryFn: async () => {
      const data = await crmApi.listLeads({ status: 'new', page: 1, size: 1 })
      return data.total ?? 0
    },
    enabled,
    staleTime: 0,
    refetchInterval: (query) =>
      query.state.error && isAxiosAuthError(query.state.error) ? false : 5_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  })

export const useLead = (id?: string) =>
  useQuery({ queryKey: KEY('lead', id), queryFn: () => crmApi.getLead(id!), enabled: !!id })

export const useSaveLead = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id?: string; data: Record<string, unknown> }) =>
      id ? crmApi.updateLead(id, data) : crmApi.createLead(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm', 'leads'] })
      qc.invalidateQueries({ queryKey: KEY('leads', 'new-count') })
    },
  })
}

export const useConvertLead = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
      crmApi.convertLead(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm', 'leads'] })
      qc.invalidateQueries({ queryKey: KEY('leads', 'new-count') })
      qc.invalidateQueries({ queryKey: ['crm', 'deals'] })
      qc.invalidateQueries({ queryKey: ['crm', 'contacts'] })
    },
  })
}

// Pipelines / Deals
export const usePipelines = () =>
  useQuery({ queryKey: KEY('pipelines'), queryFn: () => crmApi.listPipelines() })

export const useDeals = (params: Record<string, unknown> = {}) =>
  useQuery({ queryKey: KEY('deals', params), queryFn: () => crmApi.listDeals(params) })

export const useDeal = (id?: string) =>
  useQuery({ queryKey: KEY('deal', id), queryFn: () => crmApi.getDeal(id!), enabled: !!id })

export const useKanban = (params: { pipeline_id?: string; status?: string } = {}) =>
  useQuery({ queryKey: KEY('kanban', params), queryFn: () => crmApi.kanban(params) })

export const useForecast = (params: { pipeline_id?: string } = {}) =>
  useQuery({ queryKey: KEY('forecast', params), queryFn: () => crmApi.forecast(params) })

export const useSaveDeal = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id?: string; data: Record<string, unknown> }) =>
      id ? crmApi.updateDeal(id, data) : crmApi.createDeal(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm', 'deals'] })
      qc.invalidateQueries({ queryKey: ['crm', 'kanban'] })
      qc.invalidateQueries({ queryKey: ['crm', 'deal'] })
      qc.invalidateQueries({ queryKey: ['crm', 'forecast'] })
    },
  })
}

export const useMoveDeal = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: { stage_id: string; sort_order?: number } }) =>
      crmApi.moveDeal(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm', 'kanban'] })
      qc.invalidateQueries({ queryKey: ['crm', 'deals'] })
      qc.invalidateQueries({ queryKey: ['crm', 'deal'] })
      qc.invalidateQueries({ queryKey: ['crm', 'audit'] })
      qc.invalidateQueries({ queryKey: ['crm', 'forecast'] })
    },
  })
}

// Activities
export const useActivities = (params: Record<string, unknown> = {}) =>
  useQuery({ queryKey: KEY('activities', params), queryFn: () => crmApi.listActivities(params) })

export const useSaveActivity = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id?: string; data: Record<string, unknown> }) =>
      id ? crmApi.updateActivity(id, data) : crmApi.createActivity(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'activities'] }),
  })
}

export const useCompleteActivity = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, outcome }: { id: string; outcome?: string }) =>
      crmApi.completeActivity(id, outcome),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'activities'] }),
  })
}

// Communications
export const useCommunications = (params: Record<string, unknown> = {}) =>
  useQuery({ queryKey: KEY('communications', params), queryFn: () => crmApi.listCommunications(params) })

export const useLogCommunication = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown> & { channel: string }) => crmApi.logCommunication(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'communications'] }),
  })
}

// AI insights
export const useAiInsights = (entityType?: string, entityId?: string, kind?: string) =>
  useQuery({
    queryKey: KEY('ai-insights', entityType, entityId, kind),
    queryFn: () => crmApi.listInsights(entityType!, entityId!, kind),
    enabled: !!entityType && !!entityId,
  })

export const useAiSummarise = () =>
  useMutation({
    mutationFn: ({ entityType, entityId }: { entityType: string; entityId: string }) =>
      crmApi.aiSummarise(entityType, entityId),
  })

// Tickets
export const useTickets = (params: Record<string, unknown> = {}) =>
  useQuery({ queryKey: KEY('tickets', params), queryFn: () => crmApi.listTickets(params) })

export const useTicket = (id?: string) =>
  useQuery({ queryKey: KEY('ticket', id), queryFn: () => crmApi.getTicket(id!), enabled: !!id })

export const useTicketComments = (id?: string) =>
  useQuery({
    queryKey: KEY('ticket-comments', id),
    queryFn: () => crmApi.listTicketComments(id!),
    enabled: !!id,
  })

export const useSaveTicket = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id?: string; data: Record<string, unknown> }) =>
      id ? crmApi.updateTicket(id, data) : crmApi.createTicket(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'tickets'] }),
  })
}

export const useAddTicketComment = (ticketId: string) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { body: string; is_internal?: boolean }) =>
      crmApi.addTicketComment(ticketId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY('ticket-comments', ticketId) }),
  })
}

// KB
export const useKbArticles = (params: Record<string, unknown> = {}) =>
  useQuery({ queryKey: KEY('kb', params), queryFn: () => crmApi.listKb(params) })

export const useSaveKb = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id?: string; data: Record<string, unknown> }) =>
      id ? crmApi.updateKb(id, data) : crmApi.createKb(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'kb'] }),
  })
}

// Segments
export const useSegments = () =>
  useQuery({ queryKey: KEY('segments'), queryFn: () => crmApi.listSegments() })

export const useSaveSegment = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id?: string; data: Record<string, unknown> }) =>
      id ? crmApi.updateSegment(id, data) : crmApi.createSegment(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'segments'] }),
  })
}

// Templates
export const useEmailTemplates = () =>
  useQuery({ queryKey: KEY('templates'), queryFn: () => crmApi.listTemplates() })

export const useSaveTemplate = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id?: string; data: Record<string, unknown> }) =>
      id ? crmApi.updateTemplate(id, data) : crmApi.createTemplate(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'templates'] }),
  })
}

export const useTestTemplate = () =>
  useMutation({
    mutationFn: ({ id, data }: {
      id: string
      data: { channel?: string; test_phone?: string; test_email?: string }
    }) => crmApi.testTemplate(id, data),
  })

// Campaigns
export const useCampaigns = (params: Record<string, unknown> = {}) =>
  useQuery({ queryKey: KEY('campaigns', params), queryFn: () => crmApi.listCampaigns(params) })

export const useCampaign = (id?: string) =>
  useQuery({ queryKey: KEY('campaign', id), queryFn: () => crmApi.getCampaign(id!), enabled: !!id })

export const useSaveCampaign = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id?: string; data: Record<string, unknown> }) =>
      id ? crmApi.updateCampaign(id, data) : crmApi.createCampaign(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'campaigns'] }),
  })
}

export const useCampaignAudience = (
  channel: string,
  segmentId?: string,
  enabled = true,
  limit = 25,
) =>
  useQuery({
    queryKey: KEY('campaign-audience', channel, segmentId || 'all', limit),
    queryFn: () => crmApi.getCampaignAudiencePreview({
      channel,
      segment_id: segmentId || undefined,
      limit,
    }),
    enabled,
  })

// Workflows
export const useWorkflows = () =>
  useQuery({ queryKey: KEY('workflows'), queryFn: () => crmApi.listWorkflows() })

export const useSaveWorkflow = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id?: string; data: Record<string, unknown> }) =>
      id ? crmApi.updateWorkflow(id, data) : crmApi.createWorkflow(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'workflows'] }),
  })
}

// Integrations
export const useIntegrations = () =>
  useQuery({ queryKey: KEY('integrations'), queryFn: () => crmApi.listIntegrations() })

export const useUpsertIntegration = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { provider: string; label?: string; settings?: Record<string, unknown>; credentials?: Record<string, unknown> }) =>
      crmApi.upsertIntegration(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'integrations'] }),
  })
}

export const useSetIntegrationCheckoutActive = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, checkout_active }: { id: string; checkout_active: boolean }) =>
      crmApi.setIntegrationCheckoutActive(id, checkout_active),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'integrations'] }),
  })
}

// Reports
export const useCrmOverview = (range = '30d') =>
  useQuery({ queryKey: KEY('overview', range), queryFn: () => crmApi.reportOverview({ range }) })

export const useSalesReport = () =>
  useQuery({ queryKey: KEY('report-sales'), queryFn: () => crmApi.reportSales() })

export const useCampaignsReport = () =>
  useQuery({ queryKey: KEY('report-campaigns'), queryFn: () => crmApi.reportCampaigns() })

export const useTicketsReport = () =>
  useQuery({ queryKey: KEY('report-tickets'), queryFn: () => crmApi.reportTickets() })

// Audit
export const useAuditLog = (params: Record<string, unknown> = {}) =>
  useQuery({ queryKey: KEY('audit', params), queryFn: () => crmApi.listAudit(params) })

// Conversations
export const useInboxUnreadCount = (enabled = true) =>
  useQuery({
    queryKey: KEY('inbox-count'),
    queryFn: async () => {
      const [open, awaiting] = await Promise.all([
        crmApi.listConversations({ status: 'open', page: 1, size: 1 }),
        crmApi.listConversations({ status: 'awaiting_agent', page: 1, size: 1 }),
      ])
      return (open.total ?? 0) + (awaiting.total ?? 0)
    },
    enabled,
    refetchInterval: (query) =>
      query.state.error && isAxiosAuthError(query.state.error) ? false : 30_000,
  })

export const useConversations = (params: Record<string, unknown> = {}) =>
  useQuery({ queryKey: KEY('conversations', params), queryFn: () => crmApi.listConversations(params) })

export const useConversation = (id?: string) =>
  useQuery({
    queryKey: KEY('conversation', id),
    queryFn: () => crmApi.getConversation(id!),
    enabled: !!id,
    refetchInterval: 4000,
  })

export const usePostChatMessage = (id: string) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: string) => crmApi.postMessage(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY('conversation', id) })
      qc.invalidateQueries({ queryKey: KEY('inbox-count') })
      qc.invalidateQueries({ queryKey: KEY('conversations') })
    },
  })
}

// Intake tokens
export const useIntakeTokens = () =>
  useQuery({ queryKey: KEY('intake-tokens'), queryFn: () => crmApi.listIntakeTokens() })

export const useCreateIntakeToken = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { label: string; source_default?: string }) =>
      crmApi.createIntakeToken(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY('intake-tokens') }),
  })
}

// Payment follow-ups
export const usePaymentFollowups = (params: Record<string, unknown> = {}) =>
  useQuery({
    queryKey: KEY('payment-followups', params),
    queryFn: () => crmApi.listPaymentFollowups(params),
  })

export const useSavePaymentFollowup = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id?: string; data: Record<string, unknown> }) =>
      id ? crmApi.updatePaymentFollowup(id, data) : crmApi.createPaymentFollowup(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'payment-followups'] }),
  })
}

export const useDeletePaymentFollowup = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => crmApi.deletePaymentFollowup(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'payment-followups'] }),
  })
}

// Credit control
export const useCreditControls = (params: Record<string, unknown> = {}) =>
  useQuery({
    queryKey: KEY('credit-control', params),
    queryFn: () => crmApi.listCreditControls(params),
  })

export const useSaveCreditControl = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id?: string; data: Record<string, unknown> }) =>
      id ? crmApi.updateCreditControl(id, data) : crmApi.createCreditControl(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'credit-control'] }),
  })
}

export const useDeleteCreditControl = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => crmApi.deleteCreditControl(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'credit-control'] }),
  })
}

export const useCheckCreditControl = () =>
  useMutation({
    mutationFn: (data: {
      credit_control_id?: string
      party_name?: string
      contact_id?: string
      amount: number
    }) => crmApi.checkCreditControl(data),
  })

// Sales area dues
export const useSalesAreaDuesSummary = (params: Record<string, unknown> = {}) =>
  useQuery({
    queryKey: KEY('sales-area-dues-summary', params),
    queryFn: () => crmApi.getSalesAreaDuesSummary(params),
  })

export const useSalesAreaDues = (params: Record<string, unknown> = {}, enabled = true) =>
  useQuery({
    queryKey: KEY('sales-area-dues', params),
    queryFn: () => crmApi.listSalesAreaDues(params),
    enabled,
  })
