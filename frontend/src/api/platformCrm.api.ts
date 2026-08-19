import { apiClient } from './client'

const BASE = '/admin/crm'

export type Paginated<T> = {
  items: T[]
  total: number
  page: number
  size: number
  pages: number
}

export type Contact = {
  id: string
  vendor_id: string
  record_type?: 'person' | 'company' | string | null
  first_name: string
  last_name?: string | null
  title?: string | null
  email?: string | null
  phone?: string | null
  mobile?: string | null
  company?: string | null
  lifecycle_stage?: string | null
  lead_source?: string | null
  notes?: string | null
  is_active?: boolean
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
  converted_at?: string | null
  converted_contact_id?: string | null
  converted_account_id?: string | null
  converted_deal_id?: string | null
  created_at: string
  updated_at: string
  deleted_at?: string | null
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
  amount: number
  currency: string
  probability?: number | null
  expected_close_date?: string | null
  status: string
  source?: string | null
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
  due_at?: string | null
  priority?: string | null
  status?: string | null
  outcome?: string | null
  owner_id?: string | null
  completed_at?: string | null
  created_at: string
  updated_at: string
}

export type CrmOverview = {
  total_contacts?: number
  total_companies?: number
  total_leads?: number
  open_leads?: number
  open_deals?: number
  pipeline_value?: number
  weighted_value?: number
  pending_activities?: number
  conversion_rate?: number
  trends?: Record<string, number[]>
}

export const platformCrmApi = {
  overview: (range = '30d') =>
    apiClient.get<CrmOverview>(`${BASE}/reports/overview`, { params: { range } }).then((r) => r.data),

  listContacts: (params: Record<string, unknown> = {}) =>
    apiClient.get<Paginated<Contact>>(`${BASE}/contacts`, { params }).then((r) => r.data),
  createContact: (data: Partial<Contact> & { first_name: string }) =>
    apiClient.post<Contact>(`${BASE}/contacts`, data).then((r) => r.data),
  updateContact: (id: string, data: Partial<Contact>) =>
    apiClient.put<Contact>(`${BASE}/contacts/${id}`, data).then((r) => r.data),
  deleteContact: (id: string) => apiClient.delete(`${BASE}/contacts/${id}`),

  listLeads: (params: Record<string, unknown> = {}) =>
    apiClient.get<Paginated<Lead>>(`${BASE}/leads`, { params }).then((r) => r.data),
  createLead: (data: Partial<Lead>) =>
    apiClient.post<Lead>(`${BASE}/leads`, data).then((r) => r.data),
  updateLead: (id: string, data: Partial<Lead>) =>
    apiClient.put<Lead>(`${BASE}/leads/${id}`, data).then((r) => r.data),
  deleteLead: (id: string) => apiClient.delete(`${BASE}/leads/${id}`),
  restoreLead: (id: string) =>
    apiClient.post<Lead>(`${BASE}/leads/${id}/restore`).then((r) => r.data),
  convertLead: (id: string, payload: Record<string, unknown> = { create_deal: true }) =>
    apiClient.post(`${BASE}/leads/${id}/convert`, payload).then((r) => r.data),

  listPipelines: () => apiClient.get<Pipeline[]>(`${BASE}/pipelines`).then((r) => r.data),
  listDeals: (params: Record<string, unknown> = {}) =>
    apiClient.get<Paginated<Deal>>(`${BASE}/deals`, { params }).then((r) => r.data),
  createDeal: (data: Partial<Deal> & { title: string; pipeline_id: string; stage_id: string }) =>
    apiClient.post<Deal>(`${BASE}/deals`, data).then((r) => r.data),
  moveDeal: (id: string, payload: { stage_id: string; sort_order?: number }) =>
    apiClient.post<Deal>(`${BASE}/deals/${id}/move`, payload).then((r) => r.data),
  deleteDeal: (id: string) => apiClient.delete(`${BASE}/deals/${id}`),
  kanban: (params: { pipeline_id?: string; status?: string } = {}) =>
    apiClient
      .get<{ pipeline: Pipeline; columns: { stage: Stage; deals: Deal[] }[] }>(`${BASE}/deals/kanban`, {
        params,
      })
      .then((r) => r.data),

  listActivities: (params: Record<string, unknown> = {}) =>
    apiClient.get<Paginated<Activity>>(`${BASE}/activities`, { params }).then((r) => r.data),
  createActivity: (data: Partial<Activity> & { type: string; subject: string }) =>
    apiClient.post<Activity>(`${BASE}/activities`, data).then((r) => r.data),
  completeActivity: (id: string, outcome?: string) =>
    apiClient.post<Activity>(`${BASE}/activities/${id}/complete`, { outcome }).then((r) => r.data),
  deleteActivity: (id: string) => apiClient.delete(`${BASE}/activities/${id}`),

  convertContactQueryToLead: (queryId: string) =>
    apiClient.post<Lead>(`${BASE}/contact-queries/${queryId}/convert-to-lead`).then((r) => r.data),
}
