import apiClient from './client'

export interface VendorTicketTier {
  id?: string
  name: string
  price: number
  currency: string
  perks: string[]
  remaining: number
  popular?: boolean
}

export interface VendorEvent {
  id: string
  vendor_id: string
  slug: string
  title: string
  tagline?: string | null
  image_url?: string | null
  event_date?: string | null
  doors_time?: string | null
  start_time?: string | null
  venue?: string | null
  address?: string | null
  age_note?: string | null
  order_title: string
  seating_title: string
  show_seating: boolean
  max_per_order: number
  cta_label: string
  tiers: VendorTicketTier[]
  sort_order: number
  is_active: boolean
  created_at?: string | null
  updated_at?: string | null
}

export interface VendorEventCreate {
  title: string
  tagline?: string
  image_url?: string
  event_date?: string
  doors_time?: string
  start_time?: string
  venue?: string
  address?: string
  age_note?: string
  order_title?: string
  seating_title?: string
  show_seating?: boolean
  max_per_order?: number
  cta_label?: string
  tiers?: VendorTicketTier[]
  slug?: string
  sort_order?: number
  is_active?: boolean
}

export type VendorEventUpdate = Partial<VendorEventCreate>

export interface VendorEventListResponse {
  items: VendorEvent[]
  total: number
  page: number
  size: number
  pages: number
}

export const eventsApi = {
  list: async (params?: {
    page?: number
    size?: number
    search?: string
    is_active?: boolean
  }): Promise<VendorEventListResponse> => {
    const res = await apiClient.get('/vendors/me/events', { params })
    return res.data
  },

  get: async (id: string): Promise<VendorEvent> => {
    const res = await apiClient.get(`/vendors/me/events/${id}`)
    return res.data
  },

  create: async (data: VendorEventCreate): Promise<VendorEvent> => {
    const res = await apiClient.post('/vendors/me/events', data)
    return res.data
  },

  update: async (id: string, data: VendorEventUpdate): Promise<VendorEvent> => {
    const res = await apiClient.patch(`/vendors/me/events/${id}`, data)
    return res.data
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/vendors/me/events/${id}`)
  },

  uploadImage: async (file: File): Promise<{ image_url: string; url: string }> => {
    const formData = new FormData()
    formData.append('file', file)
    const res = await apiClient.post('/uploads/vendor/event-image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data
  },
}
