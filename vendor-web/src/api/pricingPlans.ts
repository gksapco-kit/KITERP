import apiClient from './client'

export interface PricingPlan {
  id: string
  vendor_id: string
  name: string
  slug: string
  description?: string | null
  price?: number | null
  currency: string
  period: string
  features: string[]
  is_featured: boolean
  cta_label: string
  cta_url: string
  sort_order: number
  is_active: boolean
  created_at?: string | null
  updated_at?: string | null
}

export interface PricingPlanCreate {
  name: string
  slug?: string
  description?: string
  price?: number | null
  currency?: string
  period?: string
  features?: string[]
  is_featured?: boolean
  cta_label?: string
  cta_url?: string
  sort_order?: number
  is_active?: boolean
}

export type PricingPlanUpdate = Partial<PricingPlanCreate>

export interface PricingPlanListResponse {
  items: PricingPlan[]
  total: number
  page: number
  size: number
  pages: number
}

export const pricingPlansApi = {
  list: async (params?: {
    page?: number
    size?: number
    search?: string
    is_active?: boolean
  }): Promise<PricingPlanListResponse> => {
    const res = await apiClient.get('/vendors/me/pricing-plans', { params })
    return res.data
  },

  get: async (id: string): Promise<PricingPlan> => {
    const res = await apiClient.get(`/vendors/me/pricing-plans/${id}`)
    return res.data
  },

  create: async (data: PricingPlanCreate): Promise<PricingPlan> => {
    const res = await apiClient.post('/vendors/me/pricing-plans', data)
    return res.data
  },

  update: async (id: string, data: PricingPlanUpdate): Promise<PricingPlan> => {
    const res = await apiClient.patch(`/vendors/me/pricing-plans/${id}`, data)
    return res.data
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/vendors/me/pricing-plans/${id}`)
  },
}
