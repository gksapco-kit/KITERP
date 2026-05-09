import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { crmApi } from '@/api/crm'

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

export const useLead = (id?: string) =>
  useQuery({ queryKey: KEY('lead', id), queryFn: () => crmApi.getLead(id!), enabled: !!id })

export const useSaveLead = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id?: string; data: Record<string, unknown> }) =>
      id ? crmApi.updateLead(id, data) : crmApi.createLead(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'leads'] }),
  })
}

export const useConvertLead = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
      crmApi.convertLead(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm', 'leads'] })
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

// Reports
export const useCrmOverview = () =>
  useQuery({ queryKey: KEY('overview'), queryFn: () => crmApi.reportOverview() })

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
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY('conversation', id) }),
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
