import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { platformCrmApi } from '@/api/platformCrm.api'
import { isAxiosAuthError } from '@/lib/errorMessages'

const KEY = (...parts: (string | number | undefined | Record<string, unknown>)[]) =>
  ['platform-crm', ...parts] as const

export const usePlatformCrmOverview = (range = '30d') =>
  useQuery({
    queryKey: KEY('overview', range),
    queryFn: () => platformCrmApi.overview(range),
  })

export const usePlatformContacts = (params: Record<string, unknown> = {}) =>
  useQuery({
    queryKey: KEY('contacts', params),
    queryFn: () => platformCrmApi.listContacts(params),
  })

export const useSavePlatformContact = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id?: string; data: Parameters<typeof platformCrmApi.createContact>[0] }) =>
      id ? platformCrmApi.updateContact(id, data) : platformCrmApi.createContact(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['platform-crm', 'contacts'] }),
  })
}

export const usePlatformLeads = (params: Record<string, unknown> = {}) =>
  useQuery({
    queryKey: KEY('leads', params),
    queryFn: () => platformCrmApi.listLeads(params),
  })

/** Count of platform CRM leads still in `new` status (sidebar badge on Leads). */
export const useNewLeadCount = (enabled = true) =>
  useQuery({
    queryKey: KEY('leads', 'new-count'),
    queryFn: async () => {
      const data = await platformCrmApi.listLeads({ status: 'new', page: 1, size: 1 })
      return data.total ?? 0
    },
    enabled,
    staleTime: 0,
    refetchInterval: (query) =>
      query.state.error && isAxiosAuthError(query.state.error) ? false : 5_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  })

export const useSavePlatformLead = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id?: string; data: Record<string, unknown> }) =>
      id ? platformCrmApi.updateLead(id, data) : platformCrmApi.createLead(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['platform-crm', 'leads'] }),
  })
}

export const useConvertPlatformLead = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload?: Record<string, unknown> }) =>
      platformCrmApi.convertLead(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform-crm'] })
    },
  })
}

export const useDeletePlatformLead = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => platformCrmApi.deleteLead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['platform-crm', 'leads'] }),
  })
}

export const useRestorePlatformLead = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => platformCrmApi.restoreLead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['platform-crm', 'leads'] }),
  })
}

export const usePlatformPipelines = () =>
  useQuery({
    queryKey: KEY('pipelines'),
    queryFn: () => platformCrmApi.listPipelines(),
  })

export const usePlatformKanban = (params: { pipeline_id?: string; status?: string } = {}) =>
  useQuery({
    queryKey: KEY('kanban', params),
    queryFn: () => platformCrmApi.kanban(params),
  })

export const useMovePlatformDeal = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: { stage_id: string; sort_order?: number } }) =>
      platformCrmApi.moveDeal(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform-crm', 'kanban'] })
      qc.invalidateQueries({ queryKey: ['platform-crm', 'deals'] })
    },
  })
}

export const useCreatePlatformDeal = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Parameters<typeof platformCrmApi.createDeal>[0]) => platformCrmApi.createDeal(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform-crm', 'kanban'] })
      qc.invalidateQueries({ queryKey: ['platform-crm', 'deals'] })
      qc.invalidateQueries({ queryKey: ['platform-crm', 'overview'] })
    },
  })
}

export const usePlatformActivities = (params: Record<string, unknown> = {}) =>
  useQuery({
    queryKey: KEY('activities', params),
    queryFn: () => platformCrmApi.listActivities(params),
  })

export const useSavePlatformActivity = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Parameters<typeof platformCrmApi.createActivity>[0]) =>
      platformCrmApi.createActivity(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['platform-crm', 'activities'] }),
  })
}

export const useCompletePlatformActivity = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, outcome }: { id: string; outcome?: string }) =>
      platformCrmApi.completeActivity(id, outcome),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['platform-crm', 'activities'] }),
  })
}
