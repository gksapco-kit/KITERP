import apiClient from './client'

export interface MarketplaceLead {
  id: string
  title: string
  category: string
  description?: string
  budget_min?: number
  budget_max?: number
  location_text?: string
  status: string
  quote_count: number
  created_at?: string
}

export interface MarketplaceQuote {
  id: string
  lead_id: string
  lead_title?: string
  price: number
  estimated_time?: string
  status: string
  is_selected: boolean
  created_at?: string
}

export const marketplaceApi = {
  listOpenLeads: () =>
    apiClient.get<MarketplaceLead[]>('/vendors/me/marketplace/leads').then((r) => r.data),
  submitQuote: (leadId: string, data: { price: number; estimated_time?: string; message?: string }) =>
    apiClient.post(`/vendors/me/marketplace/leads/${leadId}/quotes`, data).then((r) => r.data),
  listMyQuotes: () =>
    apiClient.get<MarketplaceQuote[]>('/vendors/me/marketplace/quotes').then((r) => r.data),
}

export const customerSubscriptionsApi = {
  list: (status?: string) =>
    apiClient.get('/vendors/me/subscriptions', { params: status ? { status } : {} }).then((r) => r.data),
  updateStatus: (id: string, status: 'paused' | 'active' | 'cancelled') =>
    apiClient.patch(`/vendors/me/subscriptions/${id}`, { status }).then((r) => r.data),
}
