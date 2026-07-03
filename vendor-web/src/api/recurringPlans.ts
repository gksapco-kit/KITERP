import apiClient from './client'

export interface VendorRecurringPreset {
  id?: string
  name: string
  description?: string | null
  discount_pct: number
}

export interface VendorRecurringPlan {
  id: string
  vendor_id: string
  slug: string
  title: string
  image_url?: string | null
  start_date?: string | null
  start_time?: string | null
  duration_minutes?: number | null
  price_per_session: number
  currency: string
  default_session_count: number
  min_sessions: number
  max_sessions: number
  show_upcoming: boolean
  cta_label: string
  presets: VendorRecurringPreset[]
  sort_order: number
  is_active: boolean
  created_at?: string | null
  updated_at?: string | null
}

export interface VendorRecurringPlanCreate {
  title: string
  image_url?: string
  start_date?: string
  start_time?: string
  duration_minutes?: number
  price_per_session?: number
  currency?: string
  default_session_count?: number
  min_sessions?: number
  max_sessions?: number
  show_upcoming?: boolean
  cta_label?: string
  presets?: VendorRecurringPreset[]
  slug?: string
  sort_order?: number
  is_active?: boolean
}

export type VendorRecurringPlanUpdate = Partial<VendorRecurringPlanCreate>

export interface VendorRecurringPlanListResponse {
  items: VendorRecurringPlan[]
  total: number
  page: number
  size: number
  pages: number
}

export const recurringPlansApi = {
  list: async (params?: {
    page?: number
    size?: number
    search?: string
    is_active?: boolean
  }): Promise<VendorRecurringPlanListResponse> => {
    const res = await apiClient.get('/vendors/me/recurring-plans', { params })
    return res.data
  },

  get: async (id: string): Promise<VendorRecurringPlan> => {
    const res = await apiClient.get(`/vendors/me/recurring-plans/${id}`)
    return res.data
  },

  create: async (data: VendorRecurringPlanCreate): Promise<VendorRecurringPlan> => {
    const res = await apiClient.post('/vendors/me/recurring-plans', data)
    return res.data
  },

  update: async (id: string, data: VendorRecurringPlanUpdate): Promise<VendorRecurringPlan> => {
    const res = await apiClient.patch(`/vendors/me/recurring-plans/${id}`, data)
    return res.data
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/vendors/me/recurring-plans/${id}`)
  },

  uploadImage: async (file: File): Promise<{ image_url: string; url: string }> => {
    const formData = new FormData()
    formData.append('file', file)
    const res = await apiClient.post('/uploads/vendor/recurring-plan-image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data
  },
}
