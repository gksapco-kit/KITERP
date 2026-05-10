import apiClient from './client'

export interface VendorPlan {
  id: string
  name: string
  slug: string
  description?: string
  price_monthly: number
  price_yearly?: number
  currency: string
  max_products: number
  max_services: number
  max_team_members: number
  max_storage_mb: number
  features: Record<string, boolean>
  is_active: boolean
  is_featured: boolean
  sort_order: number
}

export interface PlanCreate {
  name: string
  slug: string
  description?: string
  price_monthly: number
  price_yearly?: number
  currency?: string
  max_products?: number
  max_services?: number
  max_team_members?: number
  max_storage_mb?: number
  features?: Record<string, boolean>
  is_active?: boolean
  is_featured?: boolean
}

/** Partial update for PUT /admin/plans/:id */
export interface PlanUpdate {
  name?: string
  slug?: string
  description?: string | null
  price_monthly?: number
  price_yearly?: number | null
  currency?: string
  max_products?: number
  max_services?: number
  max_team_members?: number
  max_storage_mb?: number
  features?: Record<string, boolean>
  is_active?: boolean
  is_featured?: boolean
  sort_order?: number
}

export interface VendorPlanInfo {
  vendor_id: string
  plan: VendorPlan | null
  message?: string
}

export const plansApi = {
  list: async (): Promise<VendorPlan[]> => {
    const res = await apiClient.get('/admin/plans')
    return res.data
  },

  create: async (data: PlanCreate): Promise<VendorPlan> => {
    const res = await apiClient.post('/admin/plans', data)
    return res.data
  },

  update: async (planId: string, data: PlanUpdate): Promise<VendorPlan> => {
    const res = await apiClient.put(`/admin/plans/${planId}`, data)
    return res.data
  },

  delete: async (planId: string): Promise<void> => {
    await apiClient.delete(`/admin/plans/${planId}`)
  },

  updateFeatures: async (planId: string, features: Record<string, boolean>): Promise<VendorPlan> => {
    const res = await apiClient.put(`/admin/plans/${planId}/features`, { features })
    return res.data
  },

  getVendorPlan: async (vendorId: string): Promise<VendorPlanInfo> => {
    const res = await apiClient.get(`/admin/vendors/${vendorId}/plan`)
    return res.data
  },

  assignPlanToVendor: async (vendorId: string, planId: string): Promise<unknown> => {
    const res = await apiClient.put(`/admin/vendors/${vendorId}/plan`, { plan_id: planId })
    return res.data
  },
}
